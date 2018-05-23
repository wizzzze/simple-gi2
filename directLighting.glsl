varying vec2 vUv2;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

#include <tonemapping_pars_fragment>
#include <common>
#include <packing>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>


void main(){
	
vec3 normal = normalize( vNormal );

#ifdef USE_NORMALMAP

	normal = perturbNormal2Arb( -vPosition, normal );

	#elif defined( USE_BUMPMAP )

		normal = perturbNormalArb( -vPosition, normal, dHdxy_fwd() );

#endif

GeometricContext geometry;

geometry.position = - vPosition;
geometry.normal = normal;
geometry.viewDir = normalize( vPosition );

IncidentLight directLight;
vec3 irradiance = vec3(0.);

#if ( NUM_POINT_LIGHTS > 0 )

	PointLight pointLight;

	#pragma unroll_loop
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {

		pointLight = pointLights[ i ];

		getPointDirectLightIrradiance( pointLight, geometry, directLight );

		#ifdef USE_SHADOWMAP
		directLight.color *= all( bvec2( pointLight.shadow, directLight.visible ) ) ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
		#endif

		float dotNL = saturate( dot( geometry.normal, directLight.direction ) );

		irradiance += dotNL * directLight.color;

	}

#endif

#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )

	SpotLight spotLight;

	#pragma unroll_loop
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {

		spotLight = spotLights[ i ];

		getSpotDirectLightIrradiance( spotLight, geometry, directLight );

		#ifdef USE_SHADOWMAP
		directLight.color *= all( bvec2( spotLight.shadow, directLight.visible ) ) ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
		#endif

		float dotNL = saturate( dot( geometry.normal, directLight.direction ) );

		irradiance += dotNL * directLight.color;

	}

#endif

#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

	DirectionalLight directionalLight;

	#pragma unroll_loop
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

		directionalLight = directionalLights[ i ];

		getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );

		#ifdef USE_SHADOWMAP
		directLight.color *= all( bvec2( directionalLight.shadow, directLight.visible ) ) ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif

		float dotNL = saturate( dot( geometry.normal, directLight.direction ) );

		irradiance += dotNL * directLight.color;

	}

#endif
	

gl_FragColor = vec4( ReinhardToneMapping( irradiance ), 1. );

}