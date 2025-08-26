#!/bin/bash
PROCESSED_DIR=/mnt/www/stringerhj.co.uk/mapdata/
ZIPBASE=/mnt/audio5/raw_maps/onsdata/
NODE=/home/jules/.nvm/versions/node/v24.0.1/bin/node
# refresh UPRN data for district
${NODE} ./scripts/ONSUD.js district='E07000045' download=${ZIPBASE} output=${PROCESSED_DIR}/uprn/