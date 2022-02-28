// const Client = require('ftp');
const fs = require('fs');
const jsForce = require('jsforce');
const Client = require("./api/utils/ftpUtil/connection");

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
        return new Promise((resolve) => {
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


      var server = {
        host: process.env.FTP_HOSTNAME,
        user: process.env.FTP_USERNAME,
        password: process.env.FTP_PASSWORD,
        port: 21,
        socksproxy: proxyUrl.replace(":9293", ":1080"),
      };
      var c = new Client();
      c.on("ready", function () {
        c.get(
          'test.txt',
          (err, res) => {
            if (err) {
             
            } else {
              
              console.log(res);
            }
          }
        );
      });
      c.on("error", function (err) {
        console.error("socksftp error: " + err);
        
        c.end();
        console.log(err.code);
        return;
      });
      c.connect(server, (e) => {
        console.log(e);
        if (attempts < 6) {
          console.log("attempts ===>> " + attempts);
        } else {
          c.end();
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
        console.log({result});
        return result;
    }

    async saveToSalesforce(record){
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
        conn.sobject('Account')
            .create({ Name : 'My Account #1' }, (err, ret) => {
                if (err || !ret.success) { return console.error(err, ret); }
                console.log('Created record id : ' + ret.id);
                // ...
        });
    }
}

new App().init();