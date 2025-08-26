const fs = require('fs');
const path = require('path');
const https = require('https');
const utils = require('../../OpenOSloader/scripts/utils.js');
//const Papa = require('papaparse');

const headers = {
    'User-Agent':'ACT_exploring (ACT contact-email:technical@actionclimateteignbridge.org)'
};

function report(feature, arg){
    let properties = feature.properties;
    let cd = new Date(properties.created);
    let md = new Date(properties.modified);
    console.log(properties.title + ' cd ' + cd.toISOString() + ' id ' + feature.id); // + ' md ' + md.toString());
    if ( properties.type ){
        console.log('Type: ' + properties.type);
    }
    if ( properties.url ){
        console.log('url: ' + properties.url);
    }
    //if ( properties.tags){
    //    console.log('Tags: ' + properties.tags);
    //}
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
async function getfilesize(filepath){
    let stat = await fs.promises.stat(filepath);
    let filesize = stat.size / 1024 / 1024; // size in MB
    return filesize;
}
const base_url = 'https://geoportal.statistics.gov.uk/api/search/v1/collections/dataset/items?q=:lookup=&limit=100';
const info_url =     'https://www.arcgis.com/sharing/content/items/:id?f=json';
const download_url = 'https://www.arcgis.com/sharing/rest/content/items/:id/data';
let downloadpath = '/home/jules/Projects/maploaders/ONSloader/downloads/';
let outputpath = '/home/jules/Projects/maploaders/ONSloader/results/';

async function run(){
    let lookup = 'LUP_LSOA_2021_WD';
    let args = process.argv.splice(2);
    let where = 1;
    let target = '';
    let show_properties = false;
    let layer = 'lsoa';
    for(let arg of args){
        if ( arg.startsWith('download=')){
            downloadpath = arg.split('=')[1];
        }
        if ( arg.startsWith('output=')){
            outputpath = arg.split('=')[1];
        }
        if ( arg.startsWith('config=')){
            let configfile = arg.split('=')[1];
            let configdata = await fs.promises.readFile(configfile);
            let config = JSON.parse(configdata);
            if ( config.where ){
                where = config.where;
            }
            if ( config.product ){
                lookup = config.product;
            }
            if ( config.target ){
                target = config.target;
                fulltarget = outputpath + target;
            }
            if ( config.layer ){
                layer = config.layer;
            }
        }
    }
    let url = base_url.replace(':lookup', lookup);
    console.log('Looking for: ' + lookup);
    let latest = await find_latest_feature(url);
    if ( latest ){
        report(latest, null);
        let id = latest.id;
        let url = latest.properties.url;
        let versionsfile = path.join(path.dirname(fulltarget),'versions.json');
        let versiondata = await fs.promises.readFile(versionsfile).catch(err => {
            if ( err.code === 'ENOENT'){
                return '{}';
            }
            throw err;
        });
        let versions = JSON.parse(versiondata);
        let targetfile = path.basename(target);
        let version = versions[targetfile];
        if ( !version ){
            version = {};
        }
        let changed = false;
        if ( !version.version || version.version != id){
            changed = true;
        }
        await fs.promises.access(fulltarget).catch(err =>{
            if ( err.code === 'ENOENT'){
                changed = true;
                return;
            }
            throw err;
        });
        if ( !changed ){
            console.log('Already up to date');
        }
        if ( changed ){
            console.log('New version of ' + lookup + ' updating');
            await fs.promises.access(downloadpath, fs.constants.R_OK | fs.constants.W_OK).catch( async(err) => {
                if ( err.code === 'ENOENT'){
                    console.log('Creating ' + downloadpath);
                    await fs.promises.mkdir(downloadpath);
                    return;
                }
                throw err;
            });

            let filename = latest.properties.name;
            if ( filename && !url){
                url = download_url.replace(':id',latest.id);
                console.log('url from shared download')
                let filepath =  downloadpath + filename;

                console.log('Download url: ' + url);
                console.log('File path: ' + filepath);
                await utils.getdata(url, filepath, headers);
                console.log('Downloaded ' + filepath);
            } else {
                let murl = url + '?f=json';
                console.log('url: ' + murl);
                let json = await utils.getjson(murl, headers);
                //console.log(JSON.stringify(json));
                if ( show_properties ){
                    console.log('---------------------------------------------------------------------------------------------------------------------------');
                    for(key in json){
                        console.log(key + ' : ' + JSON.stringify(json[key]));
                    }
                }
                // ensure directories to target exist
                await fs.promises.mkdir(path.dirname(fulltarget), {recursive: true});
                if ( json.layers.length > 0 ){
                    let qurl = url + '/0/query?';
                    qurl += 'where=' + where ;
                    qurl += '&outFields=*';
                    qurl += '&outSR=27700';
                    qurl += '&f=geojson';
                    console.log('Url: ' + qurl);
                    let json = await utils.getjson(qurl, headers);
                    //console.log(JSON.stringify(json));
                    if ( show_properties ){
                        for(let f of json.features ){
                            console.log('properties: ' + JSON.stringify(f.properties));
                        }
                    }
                    await fs.promises.writeFile(fulltarget, JSON.stringify(json))
                    let d = new Date();
                    version = {
                        version: id,
                        loaded: d.toISOString()
                    };
                    versions[targetfile] = version;
                    await fs.promises.writeFile(versionsfile, JSON.stringify(versions));
                    let layersfile = outputpath + 'layers.json';
                    let layerdata = await fs.promises.readFile(layersfile).catch(err => {
                        if ( err.code === 'ENOENT'){
                            return '{}';
                        }
                    });
                    let layers = JSON.parse(layerdata);
                    layers[layer] = {
                        location: 'local',
                        path: fulltarget
                    }
                    await fs.promises.writeFile(layersfile, JSON.stringify(layers));
                    console.log('Updated layers');
                } else if ( json.tables.length > 0){

                }
            }
        }
    } else {
        console.log('Nothing found');
    }
}
run().then(()=>{
    console.log('Finished');
    process.exit(0);
}).catch((err) => {
    console.log(err.toString());
    process.exit(-1);
});
