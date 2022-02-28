// const Client = require('ftp');
const fs = require('fs');
const jsForce = require('jsforce');
const Client = require('./api/utils/ftpUtil/connection');

const {
    FTP_HOSTNAME, 
    FTP_USERNAME,
    FTP_PASSWORD,
    CLIENT_ID_PROD,
    CLIENT_SECRET_PROD,
    CLIENT_ID_SANDBOX,
    CLIENT_SECRET_SANDBOX,
    USERNAME_PROD,
    PASSWORD_PROD,
    USERNAME_SANDBOX,
    PASSWORD_SANDBOX,
    QUOTAGUARDSTATIC_URL: proxyUrl } = process.env;

const {
    username,
    password,
    clientId,
    clientSecret } = {
    prod: {
        username: USERNAME_PROD, 
        password: PASSWORD_PROD,
        clientId: CLIENT_ID_PROD,
        clientSecret: CLIENT_SECRET_PROD,      
    }, 
    sandbox: {
        username: USERNAME_SANDBOX, 
        password: PASSWORD_SANDBOX,
        clientId: CLIENT_ID_SANDBOX,
        clientSecret: CLIENT_SECRET_SANDBOX,      
    }
}['sandbox'];
const isSandbox = true;
const urlPrefix = isSandbox ? 'test' : 'login';

class App{
    async init(){
        let csvFile = await this.getFTPFile(); 
        let result = this.parseCSV(csvFile);
        this.saveToSalesforce(result);
    }
    
    async getFTPFile(){
        return new Promise((resolve, reject) => {
            /*let c = new Client();
            c.on('ready', () => {
                console.log('ftp ready');
                c.get('foo.local-copy.txt', (e, stream) => {
                    if (e){
                        console.error(e);
                        resolve(e);
                    } 
                    console.log({stream})
                    stream.once('close', () => c.end());
                    let data = '';
                    stream.on('data', chunk => data += chunk);
                    stream.on('end', resolve(data));
                });
            });
            // connect to localhost:21 as anonymous
            console.log({ 
                host: FTP_HOSTNAME, 
                user: FTP_USERNAME, 
                password: FTP_PASSWORD
            });
            c.connect({ 
                host: FTP_HOSTNAME, 
                user: FTP_USERNAME, 
                password: FTP_PASSWORD,
                connTimeout: 50000
            });*/


            let server = {
                host: FTP_HOSTNAME,
                user: FTP_USERNAME,
                password: FTP_PASSWORD,
                port: 21,
                socksproxy: proxyUrl.replace(':9293', ':1080'),
            };
            let c = new Client();
            c.on('ready', () => {
                c.get(
                    'sf-hc/CouponSelfPick220131.CSV',
                    (e, res) => {
                        if (e) {
                            console.log({e, res});
                            reject(e)
                        } else {
                            console.log({res});
                            resolve(res)
                        }
                    }
                );
            });
            c.on('error', (e) => {
                console.error('socksftp error', e);
                
                c.end();
                console.log(e.code);
                reject(res);
            });
            c.connect(server, (e) => {
                console.log(e);
                if (attempts < 6) {
                    console.log('attempts', attempts);
                } else {
                    c.end();
                    console.log(e.code);
                    reject(res);
                }
            });
        })
    }

    parseCSV(csv){
        let lines = csv.split('\n');
        let result = [];

        let headers = lines[0].split(',');
      
        for(let i = 1; i < lines.length; i++){
            let obj = {};
            let currentLine = lines[i].split(',');
            for(let j = 0; j < headers.length; j++){
                obj[headers[j]] = currentLine[j];
            }
            result.push(obj);
        }
        console.log('parseCSV', {result});
        return result;
    }

    async saveToSalesforce(records){
        let conn = new jsForce.Connection({
            oauth2: {
                loginUrl: `https://${urlPrefix}.salesforce.com`,
                clientId,
                clientSecret
            }
        });
        const login = async () => {
            return new Promise((resolve, reject) => {
                conn.login(username, password, (e, userInfo) => {
                    if (e) { 
                        console.error(e); 
                        reject(e)
                    }
                    console.log({accessToken: conn.accessToken});
                    // logged in user property
                    console.log('User ID: ' + userInfo.id);
                    console.log('Org ID: ' + userInfo.organizationId);
                    resolve();
                });
            })
        };

        let res = await login();
        console.log({res});
        let record = {
            Name: '',
            DailyTotalCoupons__c: '',
            SuccessfullyUpdatedCoupons__c: '',
            FailedUpdateCoupons__c: '',
            ListOfFailedCoupons__c: ''
        }
        conn.sobject('HC_DailyCouponSummary__c')
            .create(record, (e, ret) => {
                if (e || !ret.success) { return console.error(e, ret); }
                console.log('Created record id : ' + ret.id);
                // ...
        });
    }
}

new App().init();