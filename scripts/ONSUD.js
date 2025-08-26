const fs = require('fs');
const path = require('path');
const https = require('https');
const utils = require('../../OpenOSloader/scripts/utils.js');
const Papa = require('papaparse');

const headers = {
    'User-Agent':'ACT_exploring (ACT contact-email:technical@actionclimateteignbridge.org)'
};

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
                        }
                        if ( row['LAD24CD'] === lad_cd){
                            let r = {
                                X: row.GRIDGB1E,
                                Y: row.GRIDGB1N,
                                PC: row.PCDS,
                                WD: row.WD24CD,
                                PAR: row.PARNCP24CD,
                                OA21: row.OA21CD,
                                LSOA21: row.lsoa21cd,
                                MSOA21: row.msoa21cd
                            };
                            uprndata[row['UPRN']] = r;
                            count++;
                        }
                        total_rows_processed++;
                    }
                }
            },
            complete: (results) => {
                clearInterval(progressTimer);
                console.log('Parsing complete.');
                console.log(count + ' UPRNs matched');
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
}).catch((err) => {
    console.log(err.toString());
    process.exit(-1);
});
