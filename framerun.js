(function(exports){

	// Story object constructor

	var Story = function(storydata){

		this.width = window.innerWidth;
		this.height = window.innerHeight;

		this.scene;
		this.sceneNum = 0;
		this.assets = {};
		this.storydata = storydata ? storydata : new Storydata();

		this.svg = d3.select('body').append('svg').attr('width',this.width).attr('height',this.height).append('g').attr('id','view');

		var _this = this;

		this.loadAssets(this.storydata,this.svg,function(){
			_this.start();	
		});
		
	};

	Story.prototype = {

		start: function(scene){	
			
			this.scene = new Scene(this.storydata.script[this.sceneNum],this);
			this.scene.draw();
			
		},

		// Load story assets defined in the script

		loadAssets: function(storydata,svg,callback){

			var files = storydata.files;
			var _this = this;
			
			if(storydata.files.length === 0){
				callback();
			};

			var loadAsset = function(file,index,queueLength){

				if(file.type === 'svg'){

					d3.xml(file.name+'.svg', "image/svg+xml", function(xml) {
					
						var importedNode = document.importNode(xml.documentElement, true);
						_this.assets[file.name] = {};
						_this.assets[file.name].properties = file;
						_this.assets[file.name].src = importedNode;
			 		
			    		if(index === queueLength-1){
			    			callback();
			    		}

					});
				}

			// TODO: Add support for other types

			};

			files.forEach(function(file,index){
				loadAsset(file,index,files.length);
			});
		}
	}

	// Scene object constructor

	var Scene = function(scene,story){

		this.center = scene.centerIndex ? scene.centerIndex : "CENTER";
		this.actions = scene.actions;
		this.story = story;
		this.entities = [];
		this.mode;
		this.prevExit;
		this.enter = scene.enter ? scene.enter : "base base";
		this.exit = scene.exit ? scene.exit : "base base";
		this.enterTransition = scene.enterTransition === 'fadein' ? scene.enterTransition : "cut";
		this.exitTransition = scene.exitTransition === 'fadeout' ? scene.exitTransition : "cut";
		this.transitionLength = 500;
		var _this = this;

		scene.entities.forEach(function(entity,index){
			_this.entities.push(new Entity(entity, index, _this));
		});

	};

	Scene.prototype = {

		handleAction: function(action){

			if(action === 'NEXT'){
				this.next();
			}

			if(action === 'START'){
				this.story.sceneNum = -1;
				this.next();
			}

			// TODO: jump to different storylines

		},

		next: function(){

			this.prevExit = this.exit;
			this.prevWidth = this.getWidth();

			this.story.sceneNum += 1;			
			var newScene = this.story.storydata.script[this.story.sceneNum];
			this.update(newScene);
			
		},

		update: function(newScene){

			var _this = this;

			this.enter = newScene.enter ? newScene.enter : "base base";
			this.exit = newScene.exit ? newScene.exit : "base base";
			this.enterTransition = newScene.enterTransition === 'fadein' ? newScene.enterTransition : "cut";
			this.exitTransition = newScene.exitTransition === 'fadeout' ? newScene.exitTransition : "cut";
			this.actions = newScene.actions;
			this.center = newScene.insert ? newScene.insert : newScene.replace ? newScene.replace : "CENTER";

			if(typeof newScene.insert === 'undefined' && typeof newScene.replace === 'undefined'){
				
				this.mode = 'new';
				this.entities = [];
				
				newScene.entities.forEach(function(entity,index){
					_this.entities.push(new Entity(entity, index, _this));
				});

			};

			if(typeof newScene.insert === 'number'){

				var target = newScene.insert;
				this.mode = 'insert';
				
				this.entities.forEach(function(entity){
					entity.prev_i = entity.i;
					entity.i = entity.i < target ? entity.i : entity.i + 1;
				});

				this.entities.push(new Entity(newScene.entities[0], 0, this, target));
				
			};

			if(typeof newScene.replace === 'number'){

				var target = newScene.replace;
				var replace_index;
				this.mode = 'replace';

				this.entities.forEach(function(entity,index,array){
					if(entity.i === target){
					replace_index = index;
					}
				});

				this.entities[replace_index] = new Entity(newScene.entities[0], 0, this, target);
				
			};

			this.draw();

		},

		draw: function(){

			var _this = this;

			// Reflect current data
			this.sceneObjects = this.story.svg
					.selectAll('.frame')
					.data(this.entities, function(d){
						return d.name;
					});

			var exitObjects = function(callback){

				if(_this.sceneObjects.exit().node() === null){
					console.log('No objects exiting');
					callback();
				}

				else{

					var objectCount = _this.sceneObjects.exit().length;
					var objectsDone = 0;
				
				console.log(objectCount + ' objects exiting');
				_this.sceneObjects.exit()
					.attr("x",function(d){
							return d.moving(_this,'exit').from.x;
						})
						.attr("y",function(d){
							return d.moving(_this,'exit').from.y;
						})
						.attr('opacity',1)
						.transition()
						.duration(_this.transitionLength)
						.attr('opacity',function(){
							return _this.exitTransition === 'fadeout' ? 0 : 1;
						})
						.attr("x",function(d){
							return d.moving(_this,'exit').to.x;
						})
						.attr("y",function(d){
							return d.moving(_this,'exit').to.y;
						})
						.each('end',function(d,i){

							this.remove();
							objectsDone += 1;
							if(objectCount === objectsDone){
								callback();
							}
						});
					}
					};

		
			var updateObjects = function(callback){

				if(_this.sceneObjects.node() === null){
					console.log('No objects to update');
					callback();
				}

				else{

					var objectCount = _this.sceneObjects.length;
					var objectsDone = 0;

					console.log('Updating ' + objectCount +' objects');

			_this.sceneObjects
				.attr("x",function(d){
						return d.moving(_this,'update').from.x;
					})
					.attr("y",function(d){
						return d.moving(_this,'update').from.y;
					})
					.transition()
					.duration(_this.transitionLength)
					.attr("x",function(d){
						return d.moving(_this,'update').to.x;
					})
					.attr("y",function(d){
						return d.moving(_this,'update').to.y;
					})
					.each(function(d,i){
						var thisObj = d3.select(this);
						
						if(typeof _this.actions === "object" && thisObj.select(".action").node() === null){
							
						_this.actions.forEach(function(actionItem){

							if(d.name === actionItem.entity){
								d.createAction(actionItem.action,_this);
							}

						});
						}

						objectsDone += 1;
							if(objectCount === objectsDone){
								callback();
							}

					});

				}
				};

		
			var enterObjects = function(callback){

				if(_this.sceneObjects.enter().node() === null){
					console.log('No objects entering');
					callback();
				}

				else{

					var objectCount = _this.sceneObjects.enter().length;
					var objectsDone = 0;

					console.log('Entering ' + objectCount +' objects');
			_this.sceneObjects				
					.enter()
					.append('svg')
					.attr('class','frame')
					.attr('id',function(d,i){
						return d.name;
					})
					.attr("x",function(d){
						return d.moving(_this,'enter').from.x;
					})
					.attr("y",function(d){
						return d.moving(_this,'enter').from.y;
					})
					.attr('opacity', function(){
						return _this.enterTransition === 'fadein' ? 0 : 1;
					})

					.transition()
					.duration(_this.transitionLength)
					.attr('opacity','1')
					.attr("x",function(d){
						return d.moving(_this,'enter').to.x;
					})
					.attr("y",function(d){
						return d.moving(_this,'enter').to.y;
					})
					.each(function(d,i){

						d.addContent(this, _this);

						if(_this.mode === "insert") d.resize();
						if(d.animation) d.animate(d.animation);
						
						if(typeof _this.actions === "object"){
						_this.actions.forEach(function(actionItem){

							if(d.name === actionItem.entity){
								d.createAction(actionItem.action,_this);
							}

						});
						}
						
						objectsDone += 1;
							if(objectCount === objectsDone){
								callback();
							}

					});
				}

			}


			exitObjects(function(){
				updateObjects(function(){
					enterObjects(function(){
						_this.centerView();
						_this.ready();
					});
				});
			});

		},

		centerView: function(){

			console.log('Centering the view');

			var _this = this;
			var currentViewCenter;

			if(typeof this.center === "number"){
				var centerFrame = _this.sceneObjects.filter(function(d){return d.i === _this.center}).datum();
				currentViewCenter= -this.getOffset(centerFrame) + this.story.width/2 - centerFrame.w/2; 
				console.log("Centering by index " + this.center);
			}
			else{
				currentViewCenter = (this.story.width/2)-(this.getWidth()/2);
				console.log("Centering by content width of " + this.getWidth());
			}
			if(this.mode === 'insert' || this.mode === 'replace'){
				d3.select('#view').transition().attr('transform','translate('+currentViewCenter+',0)');
			}
			else{
				d3.select('#view').attr('transform','translate('+currentViewCenter+',0)');
			}		

		},

		getOffset: function(frame){

			var offset = this.entities.reduce(function(prev,current, index){
				
				return current.i < frame.i ? prev + parseFloat(current.w) : prev + 0;
			},0);

			return offset;
		},

		getWidth: function(){

			var width = this.entities.reduce(function(prev,current){
				return prev + parseFloat(current.w);
			},0);
		
			return width;

		},

		zoom: function(i,scene){

			var longside = scene.story.height;

			// first rearrange
			scene.entities.forEach(function(entity){

				if(entity.i === i){

					entity.i = 1;

					entity.obj.select('svg').transition()
							.attr('width',longside)
							.attr('height',longside)
							.attr('y','0')
							.attr('x',function(){
								return (scene.story.width/2)-((longside)/2);
							})
							.each('end',function(){
								d3.select(this).selectAll('rect').attr('opacity','1').transition().attr('opacity','0').remove();
								scene.actionDone(scene.entities[i]);

					});

				}

				else{

					if(i !== 1){
					entity.i = entity.i > i ? entity.i + 1 : entity.i < i ? entity.i - 1 : entity.i;
					}

					entity.obj.select('svg').transition()
							.attr('x',function(){
								
								if(entity.i < 1){
									return ((scene.story.width/2)-(longside/2)-(entity.w)+(entity.i*entity.w));
								}
								if(entity.i > 1){
								
								return ((scene.story.width/2)-(longside/2)-(entity.w)+(entity.i*entity.w))+(longside-entity.w);
								}

							})
							.each('end',function(){
								d3.select(this).attr('opacity','1').transition().attr('opacity','0');
						 		});

				}

			})
						
		},

		ready: function(){

			console.log('transitions ready');
			
		},

		clearScene: function(){

			d3.selectAll('.frame').remove();
		}

	};


	// Empty script constructor
	
	var Storydata = function(){
		
		this.files = [];
		this.script = [
			{entities: ['EMPTY','EMPTY','EMPTY'],
			 transition: "default"
			}
		];

	};


	// Entity holds information about one object in a scene and methods for moving, actions and adding content

	var Entity = function(entity,index,scene,target){

		if(entity !== "EMPTY"){

		this.file = scene.story.assets[entity.name].src ? scene.story.assets[entity.name].src : false;

		if(entity.aspectRatio === false){

			this.file.setAttribute("preserveAspectRatio","none");
		};

		this.scene = scene;
		this.i = target ? target : index;
		this.prev_i = target ? target : index;
		this.name = entity.name;
		this.type = scene.story.assets[entity.name].properties.type;

		this.enter = entity.enter ? entity.enter : false; 
		this.exit = entity.exit ? entity.exit : false;

		this.w = typeof entity.w === 'number' ? entity.w : entity.w === 'full' ? scene.story.height : parseFloat(this.file.getAttribute('width'));
		this.h = typeof entity.h === 'number' ? entity.h : entity.h === 'full' ? scene.story.height : parseFloat(this.file.getAttribute('height'));

		this.tw = typeof entity.tw === "number" ? entity.tw : this.w;
		this.th = typeof entity.th === "number" ? entity.th : this.h;

		this.animation = entity.animation ? entity.animation : false;
		this.after = entity.after ? entity.after : false;

		// Hide additional layers of animated svgs
	    		if(this.animation && this.type === 'svg'){
	    			var animLength = this.file.childElementCount;
	    			for(var i = 1; i <= animLength-1; i++){
	    				this.file.children[i].setAttribute('opacity','0');
					}
	    		}
		
		}

		else{

			this.file = false;
			this.scene = scene;
			this.i = target ? target : index;
			this.name = entity+index;
			this.w = 400;
			this.h = 400;

		}
		
	};

	Entity.prototype = {

		createAction: function(action,scene){

			var _this = this;
			
			d3.select('#'+this.name).append('rect')
				.attr('x',0)
				.attr('y',0)
				.attr('class','action')
				.attr('fill','rgba(0,0,0,0)')
				.attr('width',this.w)
				.attr('height',this.h)
				.on('click',function(){

					scene.handleAction(action);
					this.remove();
			});

			

		},

		addContent: function(frame,scene){
			
				// Add file from assets
				if(this.file){
						frame.appendChild(scene.story.assets[this.name].src);
						d3.select(frame).select('svg')
										.attr('width',this.w)
										.attr('height',this.h);			
					}

				// Create a placeholder
				else{
						var empty = d3.select(frame).append('g');

						empty.append("rect")
										.attr('width',this.w)
										.attr('height',this.h)
										.attr('fill','none')
										.attr('stroke-width','2')
										.attr('stroke','black');

						empty.append('text').text(this.i).attr('x',this.w/2).attr('y',this.h/2);
					}
			},

		resize: function(){

			var _this = this;

			d3.select('#'+this.name).select('svg')
						.attr('width',0)
						.transition()
						.duration(_this.scene.transitionLength)
						.attr('width',this.w);

			d3.select('#'+this.name)
						.attr('width',0)
						.transition()
						.duration(_this.scene.transitionLength)
						.attr('width',this.w);
						

		},

		// Returns movement object for entity entering or exiting 

		moving: function(scene,group){

			var basex = scene.getOffset(this);
			var basey = (scene.story.height/2)-this.h/2;

			var moves = { from: {}, to: {} };

			var x = d3.select("#"+this.name).attr("x");
			var y = d3.select("#"+this.name).attr("y");

			// Calculate moves for new elements

			if(group === 'enter'){

				// First define scenewide enter and exit movement

				var enter_x = scene.enter.split(' ')[0]; 
				var enter_y = scene.enter.split(' ')[1];

				// Then check framewide enter and exit definitions

				enter_x = this.enter !== false ? this.enter.split(' ')[0] : enter_x; 
				enter_y = this.enter !== false ? this.enter.split(' ')[1] : enter_y; 

				// transform definitions into coordinates

				moves.from.x = enter_x === 'left' ? 0-this.w : enter_x === 'right' ? scene.story.width : enter_x === 'base' ? basex : parseFloat(enter_x);
				moves.from.y = enter_y === 'top' ? 0-this.h : enter_y === 'bottom' ? scene.story.height : enter_y === 'base' ? basey : parseFloat(enter_y);

				moves.to.x = basex;
				moves.to.y = basey;
				
			}

			// Calculate moves for exiting elements

			if(group === 'exit'){
				
				var exit_x = scene.prevExit.split(' ')[0]; 
				var exit_y = scene.prevExit.split(' ')[1];

				exit_x = this.exit !== false ? this.exit.split(' ')[0] : exit_x; 
				exit_y = this.exit !== false ? this.exit.split(' ')[1] : exit_y;

				moves.from.x = x;
				moves.from.y = y;

				moves.to.x = exit_x === 'left' ? 0-this.w : exit_x === 'right' ? scene.story.width : exit_x === 'base' ? x : parseFloat(exit_x);
				moves.to.y = exit_y === 'top' ? 0-this.h : exit_y === 'bottom' ? scene.story.height : exit_y === 'base' ? y : parseFloat(exit_y);


			}

			// Calculate moves for present elements

			if(group === 'update'){

				if(scene.mode === 'insert'){

					moves.from.x = x !== null ? x : basex;
					moves.from.y = y !== null ? y : basey;
					moves.to.x = basex; 
					moves.to.y = basey;



				}

				else{

					moves.from.x = basex; 
					moves.from.y = basey;
					moves.to.x = basex; 
					moves.to.y = basey;
				

				}



			}
			
			return moves;
	
		},

		animate: function(mode){

			var animLength = this.file.childElementCount;
			var prevAnimFrame = -1;
			var animFrame = 1;
			var selector = d3.select('#'+this.name);

			selector.select('#'+'Layer_'+animLength).attr('opacity','0');

				var tick = function(){

					if(prevAnimFrame > 0){					
					selector.select('#'+'Layer_'+prevAnimFrame).attr('opacity','0');
					}

					selector.select('#'+'Layer_'+animFrame).attr('opacity','1');

					prevAnimFrame = animFrame;

					if(mode === 'once' && animFrame === animLength){



					}

					else{
					animFrame = animFrame === animLength ? 1 : animFrame + 1;

					setTimeout(function(){

					 	requestAnimationFrame(tick)
					 	},1000/20);
					}

					}

			requestAnimationFrame(tick);

		}


	}

	window.onload = function(){

		// Load script from external file

		d3.json('storydata.json',function(err,storydata){
			
			//if script not defined, start with empty story

			if(err){
			new Story();
			}
			else{

			new Story(storydata);
			}
		});
		

	}

})(this);