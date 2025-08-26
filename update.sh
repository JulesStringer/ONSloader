#!/bin/bash
PROCESSED_DIR=/mnt/www/stringerhj.co.uk/mapdata/
ZIPBASE=/mnt/audio5/raw_maps/onsdata/
NODE=/home/jules/.nvm/versions/node/v24.0.1/bin/node
# map layers file to merge results with
LAYERS='/mnt/www/stringerhj.co.uk/mapdata/layers.json'
# refresh UPRN data for district
${NODE} ./scripts/ONSUD.js district='E07000045' download=${ZIPBASE} output=${PROCESSED_DIR}/uprn/
# update msoa
${NODE} ./scripts/OA.js download=${ZIPBASE} output=${PROCESSED_DIR} config=MSOA_config.json
# update lsoa s
${NODE} ./scripts/OA.js download=${ZIPBASE} output=${PROCESSED_DIR} config=LSOA_config.json
# update OA
${NODE} ./scripts/OA.js download=${ZIPBASE} output=${PROCESSED_DIR} config=OA_config.json
