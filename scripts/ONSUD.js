const fs = require('fs');
const path = require('path');
const https = require('https');
const utils = require('../../OpenOSloader/scripts/utils.js');
const Papa = require('papaparse');
const error_handler = require('../../error_handler/error_handler.js');
const geocode = require('../../geocode/geocode.js');

const headers = {
    'User-Agent':'ACT_ONSUD download (ACT contact-email:technical@actionclimateteignbridge.org)'
};
const key_mapping = {
    X: "GRIDGB1E",
    Y: "GRIDGB1N",
    PC: "PCDS",
    WD: "WD25CD",
    PAR: "PARNCP25CD",
    OA21: "OA21CD",
    LSOA21: "lsoa21cd",
    MSOA21: "msoa21cd"
}
const LADCDNM = "LAD25CD"; 
const required_parish_codes = 
["E04003192","E04003193","E04012121","E04003191","E04003194","E04003195","E04003196",
"E04003197","E04003198","E04003199","E04003200","E04003201","E04003202","E04003203",
"E04003204","E04003235","E04003205","E04003206","E04003207","E04003208","E04003209",
"E04003210","E04003211","E04003212","E04003213","E04003214","E04003215","E04003216",
"E04003217","E04003218","E04003219","E04003220","E04003221","E04003222","E04003223",
"E04003232","E04003225","E04003226","E04003227","E04003228","E04003229","E04003230",
"E04003231","E04003233","E04003234","E04003236","E04003237","E04003238","E04003239",
"E04012122","E04013236","E04013237"];
let required_parish_counts = {};
function report(feature, arg){
    let properties = feature.properties;
    let cd = new Date(properties.created);
    let md = new Date(properties.modified);
    console.log(properties.title + ' cd ' + cd.toISOString()); // + ' md ' + md.toString());
}
function find_latest(feature, arg){
    let properties = feature.properties;
    if ( !arg.latest_date || arg.latest_date < properties.created){
        arg.latest_date = properties.created;
        arg.latest = feature;
    }
}
async function iterate_feature_properties(base_url, callback, arg){
    let ok = true;
    let url = base_url;
    let next_url = null;
    do {
        let page = await utils.getjson(url, headers);
        for(let feature of page.features){
            callback(feature, arg);
        }
        next_url = null;
        for(let r of page.links ){
            if ( r.rel === 'next'){
                next_url = r.href;
            }
        }
    }while(next_url != null)
}
async function find_latest_feature(base_url){
    let latest = {
        latest_date: null,
        latest: null
    }
    await iterate_feature_properties(base_url, find_latest, latest);
    return latest.latest;
}
async function extract_district(regionfile, districtfile, lad_cd){
// 1. Process header of regionfile to determine which column is lad_cd name must match LAD\d{2}CD
// 2. Process remaining rows and extract rows with lad code column matching lad_cd create an object with
//    key UPRN and object with the rest.
}
function parseCSVFile(file, lad_cd) {
    return new Promise((resolve, reject) => {
        let uprndata = {};
        let count = 0;
        const fileStream = fs.createReadStream(file, { encoding: 'utf-8' });
        let total_rows_processed = 0;
        
        // Set up a timer to report progress every second
        const progressTimer = setInterval(() => {
            console.log(`Processed ${total_rows_processed} rows matches ${count}`);
        }, 1000);

        let parish_count = {};
        for(const code of required_parish_codes){
            parish_count[code] = {
                count: 0,
                required: true
            };
        }
        Papa.parse(fileStream, {
            chunk: (results, parser )=>{
                let rows = results.data;
                if ( rows && rows.length ){
                    let keys = Object.keys(rows[0]);
                    //console.log('There were ' + rows.length + ' source rows');
                    for( let row of rows){
                        if ( total_rows_processed === 0 ){
                            let keys = Object.keys(row);
                            console.log('keys: ' + keys);
                            // check all keys currently used are present
                            let msgdata = {
                                available_keys:keys,
                                wanted_keys:key_mapping,
                                ladcd_nm:LADCDNM
                            };
                            if ( !row[LADCDNM]){
                                throw new error_handler.MaploadError(
                                    "LAD code attribute " + LADCDNM + " not available in available keys ",
                                    msgdata
                                );
                            }
                            let missing_keys = [];
                            for(const k in key_mapping){
                                let kv = key_mapping[k];
                                if ( !row[kv] ){
                                    missing_keys.push({
                                        key:k,
                                        row_key: kv
                                    });
                                }
                            }
                            if ( missing_keys.length > 0){
                                let msg = "Some attributes were not available:\n";
                                let html = '<p>The following attributes were not available:<:p><ul>';
                                for(const k of missing_keys){
                                    html += '<li>' + k.key + '  :  ' + k.row_key + '</li>';
                                }
                                html += '</ul>';
                                throw new error_handler.MaploadError(
                                    msg,
                                    msgdata,
                                    html
                                );
                            }
                        }

                        if ( row[LADCDNM] === lad_cd){
                            let r = {
                                X: row.GRIDGB1E,
                                Y: row.GRIDGB1N,
                                PC: row.PCDS,
                                WD: row.WD25CD,
                                PAR: row.PARNCP25CD,
                                OA21: row.OA21CD,
                                LSOA21: row.lsoa21cd,
                                MSOA21: row.msoa21cd
                            };
                            uprndata[row['UPRN']] = r;
                            count++;
                            if ( !parish_count[r.PAR] ){
                                parish_count[r.PAR] = {
                                    count: 0,
                                    required:false
                                }
                            }
                            parish_count[r.PAR].count++;
                        }
                        total_rows_processed++;
                    }
                }
            },
            complete: (results) => {
                clearInterval(progressTimer);
                console.log('Parsing complete.');
                console.log(count + ' UPRNs matched');
                if ( count === 0){
                    throw new error_handler.MaploadError("No UPRNs matched");
                }
                let mismatches = {};
                let html = '<p>Mismatched parish in district</p><ul>'
                for(let code in parish_count){
                    let p = parish_count[code];
                    if ( p.count === 0 && p.required ){
                        mismatches[code] = p;
                        html += '<li>' + code + ' not encountered but required</li>';
                    }
                    if ( !p.required ){
                        mismatches[code] = p;
                        html += '<li>' + code + ' encountered ' + p.count + ' unexpected</li>';
                    }
                }
                let keys = Object.keys(mismatches);
                if ( keys.length > 0 ){
                      console.log('There were mismatched parish codes: ' + JSON.stringify(mismatches, null, 2));
//                    throw new error_handler.MaploadError("Mismatched parish in district", mismatches, html);
                }
                html += '</ul>';
                resolve(uprndata);
            },
            error: reject,
            header: true
        });
    });
}
async function getfilesize(filepath){
    let stat = await fs.promises.stat(filepath);
    let filesize = stat.size / 1024 / 1024; // size in MB
    return filesize;
}
const base_url = 'https://geoportal.statistics.gov.uk/api/search/v1/collections/dataset/items?q=PRD_ONSUD&limit=100';
const info_url =     'https://www.arcgis.com/sharing/content/items/:id?f=json';
const download_url = 'https://www.arcgis.com/sharing/rest/content/items/:id/data';
let downloadpath = '/home/jules/Projects/maploaders/ONSloader/downloads/';
let outputpath = '/home/jules/Projects/maploaders/ONSloader/results/';
async function run(){
    let args = process.argv.splice(2);
    let district = 'E07000045';
    for(let arg of args){
        if ( arg.startsWith('district=')){
            district = arg.split('=')[1];
        }
        if ( arg.startsWith('download=')){
            downloadpath = arg.split('=')[1];
        }
        if ( arg.startsWith('output=')){
            outputpath = arg.split('=')[1];
        }
    }
    let latest = await find_latest_feature(base_url);
    if ( latest ){
        report(latest, null);
        let versions_file = outputpath + 'versions.json';
        let versions_data = await fs.promises.readFile(versions_file).catch((err) => {
            if ( err.code === 'ENOENT'){
                return '{}';
            }
            throw err;
        });
        let versions = JSON.parse(versions_data);
        let version = versions['uprn_lookup.json'];
        if ( !version ){
            version = {};
        }
        let ok = true;
        let districtfile = outputpath + 'uprn_lookup.json';
        await fs.promises.access(districtfile).catch(err => {
            if ( err.code === 'ENOENT'){
                ok = false;
            }
        });
        if ( !version.version || version.version !== latest.id ){
            ok = false;
        }
        if ( ok ){
            console.log('Already up to date');
            return;
        }
        let url = download_url.replace(':id',latest.id);
        let filename = latest.properties.name;
        let filepath =  downloadpath + filename;
        await fs.promises.access(downloadpath, fs.constants.R_OK | fs.constants.W_OK).catch( async(err) => {
            if ( err.code === 'ENOENT'){
                console.log('Creating ' + downloadpath);
                await fs.promises.mkdir(downloadpath);
                return;
            }
            throw err;
        });
        console.log('Download url: ' + url);
        console.log('File path: ' + filepath);
        await utils.getdata(url, filepath, headers);
        console.log('Downloaded ' + filepath);
        let destfilepath = downloadpath + filename.replace('.zip',''); 
        console.log('Unzipping to ') + destfilepath;
        await utils.unzipFile(filepath, destfilepath);
        let regionfile = destfilepath + '/Data/' + filename.replace('.zip','') + '_SW.csv';
        let size = await getfilesize(regionfile);
        console.log(regionfile + ' was ' + size + ' Mega bytes');
        console.log('Parsing ' + regionfile);
        let uprndata = await parseCSVFile(regionfile, district);
        //
        //  Assign legacy parish codes to uprndata
        //
        console.log('Reading parishes');
        let parishes = await utils.getjson('https://sites.stringerhj.co.uk/mapdata/boundaries/TeignbridgeParishes.json');
        console.log('Geocoding uprns from parishes');
        let unmatched_parishes = {};
        for(const uprn in uprndata){
            let o = uprndata[uprn];
            let code = geocode.geo_code_point(parishes, o.X, o.Y, 'CODE');
            if ( code === null){
                let p = o.PAR;
                if ( !unmatched_parishes[p]){
                    unmatched_parishes[p] = {
                        count: 0
                    }
                }
                unmatched_parishes[p].count++;
            }
            uprndata[uprn].PARISH = code;
        }
        if ( Object.keys(unmatched_parishes).length > 0 ){
            console.log('Unmatched parishes: ' + JSON.stringify(unmatched_parishes, null, 2));
        }
        console.log('Updating');
        await fs.promises.access(outputpath, fs.constants.R_OK | fs.constants.W_OK).catch( async(err) => {
            if ( err.code === 'ENOENT'){
                await fs.promises.mkdir(outputpath);
                return;
            }
            throw err;
        });
        await fs.promises.writeFile(districtfile, JSON.stringify(uprndata));
        let d = new Date();
        version = {
            version:latest.id,
            loaded: d.toISOString()
        }
        versions['uprn_lookup.json'] = version;
        await fs.promises.writeFile(versions_file, JSON.stringify(versions));
        // Now clear up
        await fs.promises.rm(destfilepath, {recursive: true});
        await fs.promises.rm(filepath);
        console.log('Deleted download files');
        // LAD\d{2}CD 
    }
}
run().then(()=>{
    console.log('Finished');
    process.exit(0);
}).catch(async (err) => {
    await error_handler.send_error_email(err, "ONSUD ONS UPRN Loader");
    console.log(err.toString());
    process.exit(-1);
});
