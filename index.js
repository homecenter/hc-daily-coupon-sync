const Client = require('ftp');
const fs = require('fs');
const jsForce = require('jsforce');

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
    PASSWORD_SANDBOX } = process.env;

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
    init(){
        let csvFile = this.getFTPFile(); 
        let result = this.parseCSV(csvFile);
        this.saveToSalesforce(result);
    }
    
    async getFTPFile(){
        let c = new Client();
        c.on('ready', () => {
          c.get('foo.local-copy.txt', (err, stream) => {
            if (err) throw err;
            stream.once('close', () => c.end());
            stream.pipe(fs.createWriteStream('foo.local-copy.txt'));
          });
        });
        // connect to localhost:21 as anonymous
        c.connect({ 
            host: FTP_HOSTNAME, 
            user: FTP_USERNAME, 
            password: FTP_PASSWORD 
        });
    }

    parseCSV(csv){

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
                    
                    console.log(conn.accessToken);
                    console.log(conn.instanceUrl);
                    // logged in user property
                    console.log("User ID: " + userInfo.id);
                    console.log("Org ID: " + userInfo.organizationId);
                    resolve();
                });
            })
        };

        await login();
        conn.sobject("Account")
            .create({ Name : 'My Account #1' }, (err, ret) => {
                if (err || !ret.success) { return console.error(err, ret); }
                console.log("Created record id : " + ret.id);
                // ...
        });
    }
}

new App().saveToSalesforce();