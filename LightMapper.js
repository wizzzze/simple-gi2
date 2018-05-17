THREE.LightMapper = function(scene, renderer){

	this.scene = new THREE.Scene();
	this.renderer = renderer;
	this.lights = [];
	this.lightIndex = 0;

	this.meshs = [];
	this.meshIndex = 0;

	this.subModifier = new THREE.GeometrySubdivisionModifier();
	for(var i = 0; i < scene.children.length; i++){
		var object = scene.children[i];
		if(object.isMesh){
			this.collectModel(object);
		}else if(object.isLight){
			this.collectLight(object);
		}

		if(object.children && object.children.length > 0){
			for(var j = 0; j < object.children.length; j++){
				this.collectModel(object.children[i]);
			}
		}
	}

}


THREE.LightMapper.prototype = {
	collectLight : function(light){
		if(light.isPointLight || light.isDirectionalLight || light.isSpotLight){
			this.lights.push(light);
		}
	},
	collectModel : function(model){
		var uv2 = this.genUV2(model.geometry);
		model.geometry.addAttribute('uv2', uv2);
		var geometry = this.subModifier.set(model).subdivision();
		var material = this.genMaterial(geometry, model.material);
		var mesh = new THREE.Mesh(geometry, material);
		mesh.position.copy(model.position);
		mesh.scale.copy(model.scale);
		mesh.rotation.copy(model.rotation);

		this.scene.add(mesh);
	},
	genMaterial : function(geometry, modelMaterial){
		var material = new THREE.MeshBasicMaterial();
		if(modelMaterial){
			if(modelMaterial.map) material.map = modelMaterial.map;
			if(modelMaterial.color) material.color = modelMaterial.color;
			if(modelMaterial.alphaMap) material.alphaMap = modelMaterial.alphaMap;
		}

		material.lightMap = this.genLightMapTexture(geometry);
		return material;
	},

	genLightMapTexture : function(geometry){
		var size = this.calculateLightmapSize(geometry);

		var dataSize = size.width * size.height;
		var data = new Uint8Array( 3 * dataSize );

		for ( var i = 0; i < dataSize; i ++ ) {

			var stride = i * 3;

			data[ stride ] = 0;
			data[ stride + 1 ] = 0;
			data[ stride + 2 ] = 0;

		}

		var texture = new THREE.DataTexture( data, size.width, size.height, THREE.RGBFormat );
		return texture;
	},

	genUV2 : function(geometry){
		var uv2;
		if(geometry instanceof THREE.ShapeBufferGeometry){
			uv2 = [];
			//shapebuffergeometry : uv is not between 0 and 1
			var positions = geometry.attributes.position.array;
			var minX, maxX, minY, maxY, x, y, i, l;
			for(i = 0, l = positions.length; i < l; i++){
				x = positions[i];
				y = positions[++i];
				i++;//ignore z component

				if(minX === undefined || x < minX) minX = x;
				if(minY === undefined || y < minY) minY = y;
				if(maxX === undefined || x > maxX) maxX = x;
				if(maxY === undefined || y > maxY) maxY = y;
			}

			var vec2 = new THREE.Vector2(minX, minY);
			var w = maxX - minX;
			var h = maxY - minY;
			for(i = 0; i < l; i++ ){
				x = positions[i];
				y = positions[++i];
				i++;

				u2 = (x - minX) / w;
				v2 = (y - minY) / h;

				if(u2 > 1 || u2 < 0)console.log(geometry);
				uv2.push(u2,v2);
			}
			uv2 = new Float32Array(uv2);
		}else if(geometry.attributes.uv){
			uv2 = geometry.attributes.uv.array;
		}else{
			throw 'uv wrap is not support';
		}

		return uv2;
	},

	calculateLightmapSize : function(geometry){
		if(geometry.area === undefined){
			throw "Geometry area missed";
		}
		var size = 128 * geometry.area;
		return { width : size, height : size };
	},



	directLight : function(){
		var light = this.lights[this.lightIndex];
		var shadowMap = light.shadow.map;
		if(shadowMap === null){
			//TODO:: render shadow map
		}
		
		/*if(shadowMap.mapSize.x < 2048 && shadowMap.mapSize.y < 2048){	
		//TODO:: rerender shadow map if map size is too small
		}*/

	}

}