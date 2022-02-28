// const Client = require('ftp');
const fs = require('fs');
const jsForce = require('jsforce');
const Client = require('./api/utils/ftpUtil/connection');
const http = require('http');
const ProxyAgent = require('proxy-agent');
const SocksClient = require('socks').SocksClient;
const url = require("url"),


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
        return new Promise(async (resolve, reject) => {
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


            /*let server = {
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
            });*/


            /*const opts = {
                method: 'GET',
                host: FTP_HOSTNAME,
                path: `ftp://${FTP_HOSTNAME}/sf-hc/CouponSelfPick220131.CSV`,
                // this is the important part!
                // If no proxyUri is specified, then https://www.npmjs.com/package/proxy-from-env
                // is used to get the proxyUri.
                username: FTP_USERNAME,
                password: FTP_PASSWORD,
                agent: new ProxyAgent(proxyUrl)
            };*/

            /*http.get(opts, (res) => {
                console.log(res.statusCode, res.headers);
                res.pipe(process.stdout);
            })*/
            const proxy = url.parse(proxyUrl);
            const host = proxy.hostname;
            const auth = proxy.auth;
            const user = auth.split(":")[0];
            const pass = auth.split(":")[1];
            const port = proxy.port || 1080;
        
            //Socks client
            const options = {
              proxy: {
                ipaddress: host,
                host,
                port,
                type: 5,
                command: "connect", // Since we are using bind, we must specify it here.
                authentication: {
                  username: user,
                  password: pass,
                },
              },
              target: {
                host: FTP_HOSTNAME, // When using bind, it's best to give an estimation of the ip that will be connecting to the newly opened tcp port on the proxy server.
                port: 21,
              },
            };

            /*const options = {
                proxy: {
                    host: '147.234.25.69',//proxyUrl.replace(':9293', ''), // ipv4 or ipv6 or hostname
                    port: 1080,
                    type: 5 // Proxy version (4 or 5)
                },
              
                command: 'connect', // SOCKS command (createConnection factory function only supports the connect command)
              
                destination: {
                    host: FTP_HOSTNAME, // github.com (hostname lookups are supported with SOCKS v4a and 5)
                    port: 21,
                    user: FTP_USERNAME,
                    password: FTP_PASSWORD,
                }
            };*/
            
            
            // Async/Await
            try {
                console.log('SocksClient.createConnection');
                const info = await SocksClient.createConnection(options);
                
                console.log(info.socket);
                // <Socket ...>  (this is a raw net.Socket that is established to the destination host through the given proxy server)
                info.socket.write(`GET /text FTP/1.1\nHost: ${FTP_HOSTNAME}\n\n`);
                info.socket.on('data', (data) => {
                    console.log(data.toString()); // ip-api.com sees that the last proxy in the chain (104.131.124.203) is connected to it.
                    
                });
            } catch (e) {
                // Handle errors
                console.error({e});
            }
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