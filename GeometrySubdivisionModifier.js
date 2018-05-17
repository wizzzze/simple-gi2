THREE.GeometrySubdivisionModifier = function(){
	this.patchThreshold = 0.01;
}

THREE.GeometrySubdivisionModifier.prototype = {
	set : function(model){
		this.model = model;
		return this;
	},

	subdivision : function(){
		var attributes = this.model.geometry.attributes;
		var geometry = new THREE.BufferGeometry();

		this.positions = Array.prototype.slice.call(attributes.position.array);
		this.normals = Array.prototype.slice.call(attributes.normal.array);
		this.uvs = Array.prototype.slice.call(attributes.uv.array);
		if(attributes.uv2){
			this.uv2s = Array.prototype.slice.call(attributes.uv2.array);
		}else{
			this.uv2s = null;
		}

		this.index = this.model.geometry.index?Array.prototype.slice.call(this.model.geometry.index.array):null;

		this.newVertexLookUpTable = [];

		var newIndices = [];
		var indexOffset = this.positions.length / 3 - 1;

		var pos1,pos2,pos3;
		var area = 0;
		var areaWeight = 0;

		var edge1 = new THREE.Vector3();
		var edge2 = new THREE.Vector3();

		if(this.index){
			for(var n = 0; n < this.index.length / 3; n++){
				var m = n * 3;

				pos1 = new Float32Array([this.positions[this.index[m] * 3], this.positions[this.index[m] * 3 + 1], this.positions[this.index[m] * 3 + 2]]);
				pos2 = new Float32Array([this.positions[this.index[m + 1] * 3], this.positions[this.index[m + 1] * 3 + 1], this.positions[this.index[m + 1] * 3 + 2]]);
				pos3 = new Float32Array([this.positions[this.index[m + 2] * 3], this.positions[this.index[m + 2] * 3 + 1], this.positions[this.index[m + 2] * 3 + 2]]);


				edge1.set(
					this.positions[this.index[m + 1] * 3] - this.positions[this.index[m] * 3], 
					this.positions[this.index[m + 1] * 3 + 1] - this.positions[this.index[m] * 3 + 1], 
					this.positions[this.index[m + 1] * 3 + 2] - this.positions[this.index[m] * 3 + 2]
				);
				edge2.set(
					this.positions[this.index[m + 2] * 3] - this.positions[this.index[m] * 3], 
					this.positions[this.index[m + 2] * 3 + 1] - this.positions[this.index[m] * 3 + 1], 
					this.positions[this.index[m + 2] * 3 + 2] - this.positions[this.index[m] * 3 + 2]
				);

				areaWeight = edge1.cross(edge2).length();
				areaWeight *= this.model.scale.x * this.model.scale.y * this.model.scale.z;
				area += areaWeight;
				if(areaWeight > this.patchThreshold){

					var triangles = this.splitTris(
						[
							[this.index[m], this.index[m+1], this.index[m+2]],
						],areaWeight
					);
					
					for(var j = 0; j < triangles.length; j ++){
						newIndices.push(triangles[j][0], triangles[j][1], triangles[j][2]);
					}
				}else{
					newIndices.push(this.index[m], this.index[m+1], this.index[m+2]);
				}
			}
			indices = new Uint16Array( newIndices );
			
			geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( this.positions ), 3 ) );
			geometry.addAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( this.normals ), 3 ) );
			geometry.addAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( this.uvs ), 2 ) );
			if(this.uv2s){
				geometry.addAttribute( 'uv2', new THREE.BufferAttribute( new Float32Array( this.uv2s ), 2 ) );
			}

			geometry.setIndex(new THREE.BufferAttribute( indices, 1 ));
		}else{
			
		}

		geometry.area = area;
		this.positions.length = 0;
		this.normals.length = 0;
		this.uvs.length = 0;
		this.newVertexLookUpTable.length = 0;
		if(this.index)
			this.index.length = 0;

		if(this.uv2s){
			this.uv2s.length = 0;
		}
		return geometry;
	},

	splitTris : function(tris, weight){
		var newTriangles = [];
		var tempTriangles = [];

		for(var i = 0; i < tris.length; i++){
			var tri = tris[i];
			var newVerteices = [];
			for(var n = 0; n < 3; n++){
				var index1 = n;
				var index2 = n + 1 >= 3 ? 0 : n + 1;

				var vertexIndex1 = tri[index1];
				var vertexIndex2 = tri[index2];

				var lookUpIndex1,lookUpIndex2;

				if(vertexIndex1 > vertexIndex2){
					lookUpIndex1 = vertexIndex2;
					lookUpIndex2 = vertexIndex1;
				}else{
					lookUpIndex1 = vertexIndex1;
					lookUpIndex2 = vertexIndex2;
				}
				var newVertex;
				if(this.newVertexLookUpTable[lookUpIndex1] && this.newVertexLookUpTable[lookUpIndex1][lookUpIndex2]){
					newVertex = this.newVertexLookUpTable[lookUpIndex1][lookUpIndex2];
				}else{
					newVertex = this.genNewVertex(vertexIndex1, vertexIndex2);
				}
				newVerteices.push(newVertex);
			}
			var newWeight = weight / 4;

			tempTriangles = [
				[ tri[0], newVerteices[0], newVerteices[2] ],
				[ newVerteices[0], tri[1], newVerteices[1] ],
				[ newVerteices[0], newVerteices[1], newVerteices[2] ],
				[ newVerteices[2], newVerteices[1], tri[2] ],
			];
			

			if(newWeight > this.patchThreshold){
				var result = this.splitTris(tempTriangles, newWeight);
				for(var m = 0; m < result.length; m++){
					newTriangles.push(result[m]);
				}
			}else{
				newTriangles.push(tempTriangles[0], tempTriangles[1], tempTriangles[2],  tempTriangles[3]);
			}
		
		}

		return  newTriangles;
	},


	genNewVertex : function(i1, i2){
		this.positions.push(
			(this.positions[i1 * 3] + this.positions[i2 * 3]) / 2, 
			(this.positions[i1 * 3 + 1] + this.positions[i2 * 3 + 1]) / 2, 
			(this.positions[i1 * 3 + 2] + this.positions[i2 * 3 + 2]) / 2
		);

		this.normals.push(
			(this.normals[i1 * 3] + this.normals[i2 * 3]) / 2,
			(this.normals[i1 * 3 + 1] + this.normals[i2 * 3 + 1]) / 2, 
			(this.normals[i1 * 3 + 2] + this.normals[i2 * 3 + 2]) / 2
		);

		this.uvs.push(
			(this.uvs[i1 * 2] + this.uvs[i2 * 2]) / 2,
			(this.uvs[i1 * 2 + 1] + this.uvs[i2 * 2 + 1]) / 2, 
		);

		if(this.uv2s){
			this.uv2s.push(
				(this.uv2s[i1 * 2] + this.uv2s[i2 * 2]) / 2,
				(this.uv2s[i1 * 2 + 1] + this.uv2s[i2 * 2 + 1]) / 2, 
			);
		}

		var index = this.positions.length / 3 - 1;

		if(i1 < i2){
			if(!this.newVertexLookUpTable[i1]){
				this.newVertexLookUpTable[i1] = {};	
			}
			this.newVertexLookUpTable[i1][i2] = index;
		}else{
			if(!this.newVertexLookUpTable[i2]){
				this.newVertexLookUpTable[i2] = {};	
			}
			this.newVertexLookUpTable[i2][i1] = index;
		}

		return index;

	}
}