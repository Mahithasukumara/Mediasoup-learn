import http from "http";
import express from "express";
import { Server } from "socket.io";
import * as mediasoup from "mediasoup";

const app=express()
const server=http.createServer(app);
const io=new Server(server,{
    cors:{
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
    }
 

})
// const peersnamespace=io.of('/mediasoup');

let worker;
let producerTransport
let consumerTransport
let producer;
let consumer;
let router;
const createWorker=async()=>{
    try{
    const newWorker=await mediasoup.createWorker({
        rtcMinPort:40000,
        rtcMaxPort:40200
    })
    newWorker.on('died',(err)=>{

        console.log("worker died");
        setTimeout(()=>{
            process.exit();
        },3000)
    })
    console.log(`Mediasoup worker created ${newWorker.pid}`)
    return newWorker;
}
catch(err){
    console.error("Error creating medisoup worker",err)
}

}
(async ()=>{
    try{
        worker=await createWorker();
    }
    catch(err){
        console.log("Medisoup worker creation failed",err)
    }

const mediaCodecs=[{
    kind:"audio",
    mimeType:"audio/opus",
    clockRate:48000,
    channels:2,
    preferredPayloadType:98,
    rtcpFeedback:[{
        type:"nack"
    }]

},{
    kind:"video",
    mimeType:"video/VP8",
    clockRate:90000,
    parameters:{
        "x-google-start-bitrate":1500
    },
    preferredPayloadType:97,
    rtcpFeedback:[{
        type:"nack"
    }]
    
}]
 router=await worker.createRouter({mediaCodecs:mediaCodecs});
io.on("connection",async(socket)=>{
    console.log(`socket connected:${socket.id}`);
    socket.emit("connection:success",{socketId:socket.id});


    socket.on("disconnect",async(reason)=>{
        console.log(`socket disconnected: ${socket.id} :reason`,reason);
    });
    socket.on("getRouterCapabilities",(callback)=>{
        const rtpCapabilities=router.rtpCapabilities;
        callback(rtpCapabilities);
    })
    const createWebRtcTransport= async (callback)=>{
        try{
            const createWebRTCTransportOptions={
                listenIps:[
                   { 
                    ip:'0.0.0.0'
                    }
                ],
                enableUdp:true,
                enableTcp:true,
                preferUdp:true,
                
            }
            const transport=await router.createWebRtcTransport(createWebRTCTransportOptions);
            console.log(`transport created:${transport.id}`);
            transport.on("dtlsstatechange",((dtlsState)=>{
                if (dtlsState==="closed"){
                    transport.close()
                }

            }))
            transport.on("close",()=>{
                console.log("transport Closed")
            })

            callback({
                params:{
                    id:transport.id,
                    dtlsParameters:transport.dtlsParameters,
                    iceParameters:transport.iceParameters,
                    iceCandidates:transport.iceCandidates
                }
            })

           

        }
        catch(error){
            console.log("error while creating a createWebRtcTransport")
            callback({
                params:{
                    error
                }
            })
        }
    }
    socket.on("createTransport",async({sender},callback)=>{
        if (sender){
            producerTransport=await createWebRtcTransport(callback);
        }
        else{
            consumerTransport=await createWebRtcTransport(callback);
        }
    })
    socket.on("connectProducerTransport",async ({dtlsParameters},callback)=>{
        try{
        await producerTransport?.connect({dtlsParameters});
         callback({msg:{success:true}});
        }
        catch(err){
            callback({msg:{failure:err}})
        }


    })
     socket.on('transport-produce',async({kind,rtpParameters},callback,errback)=>{
        try{
        producer=await producerTransport?.produce({kind,rtpParameters});
        producer?.on('close-transport',()=>{
            socket.producer?.close()
            console.log('producer closed')
        
        })
     callback({id:producer.id})
    
    }
    catch(err){
        errback(err.message);
    }}
)
    socket.on("createConsumerTransport",async ({dtlsParameters},callback,errback)=>{
      try
      {  await consumerTransport?.connect({dtlsParameters});
        callback(console.log("success creating create consumer in server"))
    }
    catch(error){
        errorback(error)
    }


    })
    socket.on("consume-transport",async ({rtpCapabilities},callback)=>{
        try{
            if(producer){
                console.log("we have a producer"+producer.kind);
                if(!router.canConsume(producer.id,rtpCapabilities))
                {
                    console.error("cannot consume");
                    return;
                }
                console.log("we can consume")
                consumer=await consumerTransport?.consume({
                    producerId:producer?.id,
                    rtpCapabilities,
                    paused:producer?.kind==="video"


                })
                consumer?.on("transport-closed",()=>{
                    console.log("transport-closed");
                    consumer?.close()
                })
                 consumer?.on("producer-closed",()=>{
                    console.log("producer-closed");
                    consumer?.close()
                })
            }
            callback({
                parameters:{
                    producerId:producer?.id,
                    id:consumer?.id,
                    kind:consumer?.kind,
                    rtpParameters:consumer?.rtpParameters
                }
            })
        }
        catch(error){
            console.log("error consuming the data",error)
            callback(error)

        }
        
    });
    socket.on("resumePausedConsumer", async (data) => {
        console.log("resume consuming data");
       await consumer?.resume();
  });
    
   
   

})

}

)();

server.listen(5000,()=>{
    console.log("Server running in port 5000");
})