# ONSUD

Origianally named after the Loader for ONS Uprn Directory for a district to a json lookup file, so given a UPRN its area codes can be determined for OA21, LSOA21, MSOA21, Parish and Ward.

This repository now is also home to OA which is a loader for other ONS products based on FeatureServer(FS) which queries a FS for features matching product code and where clause.   

## Project Setup

For the purposes of documentation I have defined these as:
```bash
    PROCESSED_DIR=/var/www/mapdata/
    ZIPBASE=/home/myuser/raw_maps/onsdata/
```
## Command line for ONSUD
The command line to run ONSUD is as follows:
```bash
node ./scripts/ONSUD.js district='E07000045' download=${ZIPBASE} output=${PROCESSED_DIR}/uprn/
```
Arguments are:
|Argument|Content|
|--------|-------|
|district=|District code for required district|
|download=|Working directory to download zip files and expanded versions|
|output=| Directory to save output to|

## Command line for OA
The command line to run OA is as follows:
```bash
${NODE} ./scripts/OA.js download=${ZIPBASE} output=${PROCESSED_DIR} config=MSOA_config.json
```
download and output arguments are the same as ONSUD, config is a json config file defined for each product.

## Running it
A shell script has been created to run a preconfigured version.
```bash
./update.sh
```
### Versions files
As well as keeping a record of the current version of each map, the versions files could be used by a remote utility to synchronise maps. There is a versions file in each target directory the following is an example from the boundaries folder:
```json
{
    "uprn_lookup.json": {
        "version": "b28cd21f0f274c77a2d556f0ee9ba594",
        "loaded": "2025-08-26T11:58:38.491Z"
    }
}
```
This version record is in the versions.json file in output directory (possiby along with other files). The version is the dataset id for the current release of ONSUD, this is compared when the script is run, it only downloads if the version is different or the output file has changed.

Versions files for OA products are similar.

### Config
Each OA product extract is as follows:
```json
{
    "product":"BDY_MSOA DEC_2021",
    "where":"MSOA21NM LIKE 'Teignbridge%'",
    "target":"oa/msoa.json",
    "layer":"msoa"
}
```
|property|notes|
|--------|-----|
|product |ONS Product code should be at the top of the product page|
|where|Where clause to select features matching our requirements|
|target|File path under output directory for geography file|
|layer|Code for layer in master layers.json file|


## Attribute names
A cut down set of attributes is copied to output records using the following mapping:
|Source attribute|Output attribute|Comment|
|----------------|----------------|-------|
|UPRN|    |key to record|
|LAD24CD|    |District code must match for record to be selected|
|GRIDGB1E|X|Easting|
|GRIDGB1N|Y|Northing|
|PCDS|PC|Postcode|
|WD24CD|WD|Ward|
|PARNCP24CD|PAR|Parish|
|OA21CD|OA21|Census output area 2021|
|lsoa21cd|LSOA21|Lower super census output area 2021|
|msoa21cd|MSOA21|Middle super census output area 2021|

Periodically it is likely that these variable names will change in the source data, at which point this script will need to be updated.

## Outstanding issues
+ Implement OA for table outputs as well as layers.