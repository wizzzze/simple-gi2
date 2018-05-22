THREE.LightMapper = function(scene, renderer){

	this.scene = new THREE.Scene();
	this.renderer = renderer;
	this.lights = [];

	this.lightState = new LightState();

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

	this.orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
	this.orthographicCamera.position.set(0, 0, 0);


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
		var size = Math.floor(128 * geometry.area);

		return { width : size, height : size };
	},


	setupShadowMap : function(light){
		var shadowMap = light.shadow.map;
		if(shadowMap === null){
			//render shaodw map
		}

		//如果shadow map 分辨率不够，则提高分辨率后重新渲染一次shadow map

	},
	directLight : function(){
		var light, shadowMap;
		for(var i = 0; i < this.lights.length; i ++){
			var light = this.lights[i];
			this.setupShadowMap(light);
		}

		this.lightState.setup(this.lights);

		var tempScene = new THREE.Scene();

		var tempRenderTarget = new THREE.WebGLRenderTarget( 512, 512, {
			depthBuffer : false,
			stencilBuffer : false
		});

		var uniforms = {};

		uniforms.directionalLights = { value : this.lightState.state.directional };
		uniforms.spotLights = { value : this.lightState.state.spot };
		uniforms.pointLights = { value : this.lightState.state.point };

		uniforms.directionalShadowMap = { value : this.lightState.state.directionalShadowMap };
		uniforms.directionalShadowMatrix = { value : this.lightState.state.directionalShadowMatrix };
		uniforms.spotShadowMap = { value : this.lightState.state.spotShadowMap };
		uniforms.spotShadowMatrix = { value : this.lightState.state.spotShadowMatrix };
		uniforms.pointShadowMap = { value : this.lightState.state.pointShadowMap };
		uniforms.pointShadowMatrix = { value : this.lightState.state.pointShadowMatrix };

		var material = new THREE.ShaderMaterial({
			uniforms : uniforms,
			vertextShader : ShaderLib.vertextShader,
			fragmentShader : ShaderLib.fragmentShader,
		});

		tempScene.overrideMaterial = material;

		for(var m = 0, n = this.scene.children.length; m < n; m ++){
			//清空tempScene中所有的Mesh
			
			for(var i = 0, j = tempScene.children.length; i < j; i++){
				tempScene.remove(tempScene.children[i]);
			}

			var mesh = this.scene.children[m];

			// 有时部分网格会被莫名裁剪掉，可在此处关闭裁剪，具体原因仍需要进一步查证
			// mesh.frustumCulled = false;
			
			var lightTexture = mesh.material.lightMap.image;
			tempRenderTarget.setSize(lightTexture.width, lightTexture.height);

			tempScene.add(mesh);

			this.renderer.clear();
			this.renderer.render(tempScene, this.orthographicCamera, tempRenderTarget);

			var dataSize = lightTexture.width * lightTexture.height;
			var data = new Uint8Array( 3 * dataSize );

			this.renderer.readRenderTargetPixels(tempRenderTarget, 0, 0, lightTexture.width, lightTexture.height, data);

			this.updateLightMap(mesh, data);
		}
	},

	updateLightMap : function(mesh, data){
		var imageData = mesh.material.lightMap.image.data;
		var length  = imageData.length / 3;

		for(var i = 0 ; i < length; i ++){
			var stride = i * 3;
			imageData[ stride ] = data[ stride ];
			imageData[ stride + 1 ] = data[ stride + 1 ];
			imageData[ stride + 2 ] = data[ stride + 2 ];
		}

		mesh.material.lightMap.needsUpdate = true;


	}

}