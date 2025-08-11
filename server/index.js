import http from "http";
import express from "express";
import { Server } from "socket.io";
import mediasoup from "mediasoup";

const app=express()
const server=http.createServer(app);
const io=new Server(server,{
    cors:true,

})
const peersnamespace=io.of('/mediasoup');

let worker;
let sendtransport;
let recievetransport;
let producer;
let consumer;
let router;
const createWorker=async()=>{
    const newWorker=await mediasoup.createWorker({
        rtcMinPort:1000,
        rtcMaxPort:1050
    })
    newWorker.on('died',(err)=>{

        console.log("worker died");
        setTimeout(()=>{
            process.exit();
        },3000)
    })
    console.log(`Mediasoup worker created ${newWorker.id}`)
    return newworker;

}
createWorker()

server.listen(5000,()=>{
    console.log("Server running in port 8000");
})