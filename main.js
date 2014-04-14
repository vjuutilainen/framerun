(function(exports){

	// The constructor for main story object handling Scenes according to script and holding assets

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

		}

		files.forEach(function(file,index){
			loadAsset(file,index,files.length);
		});
		
		}

	}

	// Scene object keeps data of entities in a given scene and has methods for arranging and drawing the scene

	var Scene = function(scene,story){

		this.viewOffset = 0;
		this.centerIndex = 1;
		this.actions = scene.actions;
		this.story = story;
		this.entities = [];
		this.transition = scene.transition ? scene.transition : "cut";
		this.mode;

		var _this = this;

		scene.entities.forEach(function(entity,index){
			_this.entities.push(new Entity(entity, index, _this));
		});

		console.log("Built a scene");
		console.log(this);

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

			this.story.sceneNum += 1;			
			var newScene = this.story.storydata.script[this.story.sceneNum];
			this.update(newScene);
			
		},

		update: function(newScene){

			var _this = this;

			this.transition = newScene.transition ? newScene.transition : 'cut';

			this.actions = newScene.actions;

			if(typeof newScene.insert === 'undefined' && typeof newScene.replace === 'undefined'){

				this.mode = 'new';
				this.entities = [];
				
				newScene.entities.forEach(function(entity,index){
					_this.entities.push(new Entity(entity, index, _this));
				});

				console.log("Cleared the scene");
				console.log(this);

			};

			if(typeof newScene.insert === 'number'){

				var target = newScene.insert;

				this.transition = 'insert';
				this.mode = 'insert';
				this.centerIndex = newScene.insert;

				this.entities.forEach(function(entity){
					entity.prev_i = entity.i;
					entity.i = entity.i < target ? entity.i : entity.i + 1;
				});

				

				this.entities.push(new Entity(newScene.entities[0], 0, this, target));

				console.log("Inserted into a scene");
				console.log(this);
				
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

			console.log("Replaced in a scene");
			console.log(this);
				
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

		console.log('handling present objects');
			// Handle present objects
			this.sceneObjects
				.attr("x",function(d){
						return d.moving(_this).from.x;
					})
					.attr("y",function(d){
						return d.moving(_this).from.y;
					})
					.transition()
					.duration(1000)
					.attr("x",function(d){
						return d.moving(_this).to.x;
					})
					.attr("y",function(d){
						return d.moving(_this).to.y;
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

					});

		console.log('handling new objects');
			// Handle new objects
			this.sceneObjects				
					.enter()
					.append('svg')
					.attr('class','frame')
					.attr('id',function(d,i){
						return d.name;
					})
					.attr("x",function(d){
						return d.moving(_this).from.x;
					})
					.attr("y",function(d){
						return d.moving(_this).from.y;
					})
					.transition()
					.attr("x",function(d){
						return d.moving(_this).to.x;
					})
					.attr("y",function(d){
						return d.moving(_this).to.y;
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
						
				
					});


		console.log('removing objects');
			// Handle removable objects
			this.sceneObjects.exit().remove();

			if(this.mode === 'insert' || this.mode === 'replace'){

				var insertOffset = this.getOffset(this.sceneObjects.filter(function(d){return d.i === _this.centerIndex}).datum());
				var insertWidthOffset = (this.sceneObjects.filter(function(d){return d.i === _this.centerIndex}).datum().w/2);

				this.viewOffset = -insertOffset + this.story.width/2 - insertWidthOffset;
				d3.select('#view').transition().duration(1000).attr('transform','translate('+this.viewOffset+',0)');
			}
			else{
				this.viewOffset = (this.story.width/2)-(this.getWidth()/2);
				d3.select('#view').attr('transform','translate('+this.viewOffset+',0)');
			}

		},

		getOffset: function(frame){

			var offset = this.entities.reduce(function(prev,current, index){
				
				return current.i < frame.i ? prev + parseFloat(current.w) : prev + 0;
			},0);

			//console.log(offset + " " + "frame " + frame.name);
			return offset;
		},

		getWidth: function(){

			var width = this.entities.reduce(function(prev,current){
				return prev + parseFloat(current.w);
			},0);
			//console.log("scenewidth " + width);
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

		actionDone: function(entity){

			this.story[entity.after]();
			
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

		this.w = typeof entity.w === 'number' ? entity.w : entity.w === 'full' ? scene.story.height : parseInt(this.file.getAttribute('width'));
		this.h = typeof entity.h === 'number' ? entity.h : entity.h === 'full' ? scene.story.height : parseInt(this.file.getAttribute('height'));

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

			// For entity-specific movement, TODO
			// if(prop.move){
			// if(prop.move.from){
			// 	this.move.from = { x: prop.move.from.split(' ')[0] ? prop.move.from.split(' ')[0] : 'left',
			// 				  y: prop.move.from.split(' ')[1] ? prop.move.from.split(' ')[1] : 'base'
			// 				};
			// }

			// if(prop.move.to){
			// 	this.move.to = { x: prop.move.to.split(' ')[0] ? prop.move.to.split(' ')[0] : 'base',
			// 				y: prop.move.to.split(' ')[1] ? prop.move.to.split(' ')[1] : 'base',
			// 			  };
			// }
			// }
		
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

			d3.select('#'+this.name).select('svg')
						.attr('width',0)
						.transition()
						.duration(1000)
						.attr('width',this.w);

			d3.select('#'+this.name)
						.attr('width',0)
						.transition()
						.duration(1000)
						.attr('width',this.w);
						

		},

		moving: function(scene){

			var basex = scene.getOffset(this);

			var basey = (scene.story.height/2)-this.h/2;

			var moves = { from: {}, to: {} };

			var x = d3.select("#"+this.name).attr("x");
			var y = d3.select("#"+this.name).attr("y");

			// Scenewide transitions
			if(scene.transition){
				if(scene.transition === "cut"){
					moves.from.x = basex; 
					moves.from.y = basey;
					moves.to.x = basex; 
					moves.to.y = basey;
				}

				if(scene.transition === "insert"){

					moves.from.x = x !== null ? x : basex;
					moves.from.y = y !== null ? y : basey;
					moves.to.x = basex; 
					moves.to.y = basey;

				}

				if(scene.transition === "default"){
					moves.from.x = 0;
					moves.from.y = 0;
					moves.to.x = basex; 
					moves.to.y = basey;
				}

			}

			// Entity-specific transitions

			if(this.move){

				moves.from.x === 'left' ? 0-this.w : this.move.from.x === 'right' ? scene.story.width : this.move.from.x === 'base' ? basex : this.move.from.x;
				moves.from.y = this.move.from.y === 'top' ? 0-this.h : this.move.from.y === 'bottom' ? scene.story.height : this.move.from.y === 'base' ? basey : this.move.from.y;

				moves.to.x = this.move.to.x === 'left' ? 0-this.w : this.move.to.x === 'right' ? scene.story.width : this.move.to.x === 'base' ? basex : this.move.to.x;
				moves.to.y = this.move.to.y === 'top' ? 0-this.h : this.move.to.y === 'bottom' ? scene.story.height : this.move.to.y === 'base' ? basey : this.move.to.y;

			}
			
			return moves;
	
		},

		reset: function(){

			this.obj.attr('x','0').attr('y','0').attr('width','0').attr('height','0');

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