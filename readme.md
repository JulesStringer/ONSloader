# ONSUD

Loader for ONS Uprn Directory for a district to a json lookup file, so given a UPRN its area codes can be determined for OA21, LSOA21, MSOA21, Parish and Ward. 

## Project Setup

For the purposes of documentation I have defined these as:
```bash
    PROCESSED_DIR=/var/www/mapdata/
    ZIPBASE=/home/myuser/raw_maps/onsdata/
```
## Command line
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

## Known issues
