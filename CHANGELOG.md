# Changelog

## [0.6.3](https://github.com/soteiro/cassandra/compare/v0.6.2...v0.6.3) (2026-10-09)


### Bug Fixes

* **backend:** el rollback del deploy funciona con releases que migran la base ([#40](https://github.com/soteiro/cassandra/issues/40)) ([9c414a5](https://github.com/soteiro/cassandra/commit/9c414a594eb7dbc34130f5eb7aa9f21b4a0683c5))

## [0.6.2](https://github.com/soteiro/cassandra/compare/v0.6.1...v0.6.2) (2026-10-06)


### Bug Fixes

* please ([93d2ae9](https://github.com/soteiro/cassandra/commit/93d2ae97518237913420481eaa9d05abb778202d))

## [0.6.1](https://github.com/soteiro/cassandra/compare/v0.6.0...v0.6.1) (2026-10-06)


### Bug Fixes

* qa ([fe57c7a](https://github.com/soteiro/cassandra/commit/fe57c7a350724d6941922871259c8f61342d02d5))

## [0.6.0](https://github.com/soteiro/cassandra/compare/v0.5.3...v0.6.0) (2026-10-06)


### Features

* añadir indicadores visibles de carga durante navegación y solicitudes de datos ([7f29fa8](https://github.com/soteiro/cassandra/commit/7f29fa83cf5f9e5b58fe43f0dbfa0e5a62766b97))

## [0.5.3](https://github.com/soteiro/cassandra/compare/v0.5.2...v0.5.3) (2026-10-06)


### Bug Fixes

* add APK updater plugin for native Android app updates ([2e5e779](https://github.com/soteiro/cassandra/commit/2e5e7795fb87f1cbeb923b53e51490b740ddb208))

## [0.5.2](https://github.com/soteiro/cassandra/compare/v0.5.1...v0.5.2) (2026-10-06)


### Bug Fixes

* **frontend:** improve responsiveness of filters and buttons in various components ([9fbb779](https://github.com/soteiro/cassandra/commit/9fbb779b92eb7e00538675628221fa6b7ef156da))

## [0.5.1](https://github.com/soteiro/cassandra/compare/v0.5.0...v0.5.1) (2026-10-05)


### Bug Fixes

* **backend:** aislamiento entre usuarios en recursos referenciados ([140672c](https://github.com/soteiro/cassandra/commit/140672c5229eceef61b150902b6fb16d0ba4c728))
* **backend:** aislamiento entre usuarios en recursos referenciados ([5940e8d](https://github.com/soteiro/cassandra/commit/5940e8d2189244e54502bf7dd3ccf691f945009a))
* **backend:** códigos HTTP correctos para errores de la base y validaciones pendientes ([b88243c](https://github.com/soteiro/cassandra/commit/b88243cb14ac5a4e5fe20f0a6b7437987925adcd))
* **backend:** IP real solo desde proxies de confianza, errores sin SQL y unicidad por usuario ([e56a1cd](https://github.com/soteiro/cassandra/commit/e56a1cda26465fe2a42e108837534493b165784f))
* **backend:** sesión de usuarios eliminados y campos protegidos ([b636ccb](https://github.com/soteiro/cassandra/commit/b636ccb7000b3b7551a8def2189f2c2f8cb94ff6))

## [0.5.0](https://github.com/soteiro/cassandra/compare/v0.4.0...v0.5.0) (2026-10-04)


### Features

* **backend:** subcomando seed-demo con datos de ejemplo para QA ([087a08a](https://github.com/soteiro/cassandra/commit/087a08a09589ebe06f537538e153ef04bcccb25d))


### Bug Fixes

* **deploy:** aceptar s/si/y/yes al confirmar el cambio de producción ([626ec5e](https://github.com/soteiro/cassandra/commit/626ec5ea5f0f08d49a1a081960d87b77ca108c8f))
* **deploy:** cassandra_qa es dueño del esquema public de su base ([235814a](https://github.com/soteiro/cassandra/commit/235814a7822b58b44c171162561152fa41ba5618))
* **deploy:** cassandra_qa también es dueño de su base de datos ([ffc7dc4](https://github.com/soteiro/cassandra/commit/ffc7dc459d5c92cca44cfe8ab1caa789f467b18a))

## [0.4.0](https://github.com/soteiro/cassandra/compare/v0.3.0...v0.4.0) (2026-10-04)


### Features

* **backend:** administración de cuentas por CLI y CORS configurable ([807ff00](https://github.com/soteiro/cassandra/commit/807ff0053d8370f1dac3f9a12a6024019d40ebb6))
* **backend:** exigir un JWT_SECRET propio de al menos 32 caracteres ([5de29fb](https://github.com/soteiro/cassandra/commit/5de29fb44dc041d1de44de6c946f5281c4654dae))
* la app Android se conecta al servidor que elija cada usuario ([701ee17](https://github.com/soteiro/cassandra/commit/701ee17a6484ae1095a559541f0be931a524f91f))
* la app Android se conecta al servidor que elija cada usuario ([b79b1f5](https://github.com/soteiro/cassandra/commit/b79b1f5eca9eed154a4ea8e083374db28085903f))

## [0.3.0](https://github.com/soteiro/cassandra/compare/v0.2.1...v0.3.0) (2026-10-04)


### Features

* botón de buscar actualizaciones en la app Android ([a523fce](https://github.com/soteiro/cassandra/commit/a523fcebc9e4119b3a2849f0f01ff794e1bd3b4a))
* botón de buscar actualizaciones en la app Android ([f5a3f29](https://github.com/soteiro/cassandra/commit/f5a3f292b630c5551005f484e95fb0096ca00af3))

## [0.2.1](https://github.com/soteiro/cassandra/compare/v0.2.0...v0.2.1) (2026-10-04)


### Bug Fixes

* **ci:** build del APK en la release y recompilación manual por tag ([b6e7887](https://github.com/soteiro/cassandra/commit/b6e788750a202e420b46c7ef4e6fe674f4719a97))
* **ci:** build del APK en la release y recompilación manual por tag ([a930825](https://github.com/soteiro/cassandra/commit/a9308259a3e767b7e47971aa3080d3776cef9de0))

## [0.2.0](https://github.com/soteiro/cassandra/compare/v0.1.0...v0.2.0) (2026-10-04)


### Features

* build de release con versión, APK firmado y assets ([22459d2](https://github.com/soteiro/cassandra/commit/22459d2fb50261632d1a4591e9161345447a4747))
* build de release con versión, APK firmado y assets ([5a1f4b9](https://github.com/soteiro/cassandra/commit/5a1f4b996dc368e88e1c7c002b5f9794ba23aae5))
