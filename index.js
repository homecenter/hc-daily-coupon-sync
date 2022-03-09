const jsForce = require('jsforce');
const Client = require('./connection');
require('dotenv').config();
const moment = require('moment');

const environment = process.env.ENVIRONMENT || 'sandbox';
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
}[environment];
const isSandbox = environment === 'sandbox';
const urlPrefix = isSandbox ? 'test' : 'login';

class App{
    conn = new jsForce.Connection({
        version: 53,
        maxRequest: 200,
        oauth2: {
            loginUrl: `https://${urlPrefix}.salesforce.com`,
            clientId,
            clientSecret
        }
    });
    fileDate = moment().subtract(1, 'days');
    results = {success: [], failure: []}

    async init(){
        setTimeout(() => {
            let csvFile = await this.getFTPFile();
            if(csvFile){
                let data = this.parseCSV(csvFile);
                let couponNumberList = data.map(({iSerialNo}) => iSerialNo);
                let conn = await this.connectToSalesforce();
                console.log('couponNumberList', couponNumberList)
                let res = await this.updateCoupons(couponNumberList);
                console.log('updateCoupons', this.results);
            };
            //let s = await this.createSummary();
            return true;
        }, 5000)
    }

    async getFTPFile(){
        return new Promise(async (resolve, reject) => {
            let server = {
                host: FTP_HOSTNAME,
                user: FTP_USERNAME,
                password: FTP_PASSWORD,
                port: 21,
                socksproxy: proxyUrl.replace(':9293', ':1080'),
            };
            let key = this.fileDate.format('YYMMDD');//220124;
            let c = new Client();
            c.on('ready', () => {
                try{
                    console.log('file path', `/sf-hc/CouponSelfPick${key}.CSV`)
                    c.get(
                        `/sf-hc/CouponSelfPick${key}.CSV`,
                        (e, socket) => {
                            if (e) {
                                console.log({e, socket});
                                reject(e)
                            } else {
                                let data = '';
                                socket.setEncoding('utf8');
                                socket
                                .on('data', chunk => data += chunk)
                                .on('end', res => resolve(data))
                            }
                        }
                    );
                } catch(e){
                    console.error(e);
                }
            });
            c.on('error', (e) => {
                console.error('socksftp error', e);
                c.end();
                console.log(e.code);
                reject(e);
            });
            c.connect(server, (e) => {
                console.log(e);
                if (attempts < 6) {
                    console.log('attempts', attempts);
                } else {
                    c.end();
                    console.log(e.code);
                    reject(e);
                }
            });           
        })
    }

    parseCSV(csv){
        let lines = csv.replace(/\r/g, '').split(/\n/);
        let result = [];

        let headers = lines[0].replace(/\s/g, '').split(',');
      
        for(let i = 1; i < lines.length; i++){
            let obj = {};
            let currentLine = lines[i].replace(/\s/g, '').split(',');
            for(let j = 0; j < headers.length; j++){
                obj[headers[j]] = currentLine[j];
            }
            result.push(obj);
        }
        return result;
    }

    async connectToSalesforce(){
        return new Promise((resolve, reject) => {
            this.conn
            .login(username, password, (e, userInfo) => {
                if (e) { 
                    console.error(e); 
                    reject(e)
                }
                console.log({userInfo, accessToken: this.conn.accessToken});
                resolve();
            });
        })
    }

    async updateCoupons(couponNumberList){      
        new Promise((resolve, reject) => {
            let records = couponNumberList.map((CouponNumber__c) => ({CouponNumber__c, Used__c: true}));
    
            var job = this.conn.bulk.createJob('Coupon__c', 'upsert', {extIdField: 'CouponNumber__c'});
            var batch = job.createBatch();

            batch.execute(records);
            // listen for events
            batch.on("error", (e) => { // fired when batch request is queued in server.
                console.log('Error, batchInfo:', e);
                reject(e)
            });
            batch.on("queue", ({id, jobId, state, createdDate}) => { // fired when batch request is queued in server.
                console.log('queue, batchInfo:', {id, jobId, state, createdDate});
                batch.poll(1000 /* interval(ms) */, 20000 /* timeout(ms) */); // start polling - Do not poll until the batch has started
            });
            batch.on("response", (rets) => { // fired when batch finished and result retrieved
                console.log({rets})
                for (var i = 0; i < rets.length; i++) {
                    if (rets[i].success) {
                        this.results.success.push(rets[i].id)
                    } else {
                        this.results.failure.push(rets[i].id)
                    }
                }
                resolve();
            });
        })
    }

    async createSummary(){     
        let {success, failure} = this.results;
        let record = {
            Name: `HC DCP ${this.fileDate.format('DD-MM-YYYY')}`,
            DailyTotalCoupons__c: success.length + failure.length,
            SuccessfullyUpdatedCoupons__c: success.length,
            FailedUpdateCoupons__c: failure.length,
            ListOfFailedCoupons__c: failure.join(', ')
        }

        this.conn
        .sobject('Coupon__c')
        .retrieve([
            ...success,
            ...failure
        ], function(err, accounts) {
            if (err) { return console.error(err); }
            for (var i=0; i < accounts.length; i++) {
              console.log("Name : " + accounts[i].Name);
            }
            // ...
        });

        console.log('Summary', record);
        this.conn
        .sobject('HC_DailyCouponSummary__c')
        .create(record, (e, res) => {
            if (e || !res.success) { return console.error(e, res); }
            console.log('Created record id : ' + res.id);
            // ...
        });
    } 
}
new App().init();