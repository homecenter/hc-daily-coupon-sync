// const Client = require('ftp');
const fs = require('fs');
const jsForce = require('jsforce');
const Client = require('./api/utils/ftpUtil/connection');
const http = require('http');
const ProxyAgent = require('proxy-agent');
const SocksClient = require('socks').SocksClient;
const url = require("url");
const { resolve } = require('path');


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
    conn = new jsForce.Connection({
        oauth2: {
            loginUrl: `https://${urlPrefix}.salesforce.com`,
            clientId,
            clientSecret
        }
    });

    async init(){
        let csvFile = await this.getFTPFile(); 
        let result = this.parseCSV(csvFile);
        let couponNumberList = result.map(({iSerialNo}) => iSerialNo);
        await this.connectToSalesforce();

        let {} = this.updateCoupons(couponNumberList);
        //this.createSummary()
        //this.saveToSalesforce(result);
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
            let c = new Client();
            c.on('ready', () => {
                c.get(
                    '/sf-hc/CouponSelfPick220124.CSV',
                    (e, socket) => {
                        if (e) {
                            console.log({e, socket});
                            reject(e)
                        } else {
                            //console.log({socket});
                            let data = '';
                            socket.setEncoding('utf8');
                            socket
                            .on('data', chunk => data += chunk)
                            .on('end', data => resolve(data))
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
        console.log({csv});
        let lines = csv.replace(/ +/, '').split(/\n/);
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

    async connectToSalesforce(){
        return new Promise((resolve, reject) => {
            this.conn
            .login(username, password, (e, userInfo) => {
                if (e) { 
                    console.error(e); 
                    reject(e)
                }
                console.log({accessToken: this.conn.accessToken});
                resolve();
            });
        })
    }

    async updateCoupons(couponNumberList){      
        this.conn
        .query(`SELECT Id FROM Coupon__c WHERE CouponNumber__c IN (${couponNumberList.join(',')})`)
        .update({Used__c: true}, 'Coupon__c', (e, res) => {
            console.log('updateCoupons', {res});
            if (e) {  
                console.error(e); 
                reject(e)
            } else resolve(res)
        })
    }

    async createSummary(couponsCount, successCount, failedCount){     
        let record = {
            Name: 'HC DCP 15-02-2022 ( today-1)',
            DailyTotalCoupons__c: couponsCount || 0,
            SuccessfullyUpdatedCoupons__c: successCount,
            FailedUpdateCoupons__c: failedCount,
            ListOfFailedCoupons__c: failedList
        }

        this.conn
        .sobject('HC_DailyCouponSummary__c')
        .create(record, (e, ret) => {
            if (e || !ret.success) { return console.error(e, ret); }
            console.log('Created record id : ' + ret.id);
            // ...
        });
    } 
}

new App().init();