import {useState,useEffect,useRef} from 'react';
import {io} from 'socket.io-client';
import {Device} from 'mediasoup-client'

export default function Home()
{

const [device,setDevice]=useState()
const  [params,setParams]=useState({})
const [socket,setSocket]=useState()
const [rtpCapabilities,setRtpCapabilities]=useState(null)
const [producerTransport,setProducerTransport]=useState()
const [consumerTransport,setConsumerTransport]=useState()
const localVideoRef=useRef(null)
const remoteVideoRef=useRef(null)

async function startCamera(){
    try{
        const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});

        if (localVideoRef.current){
            localVideoRef.current.srcObject=stream;

            const videoTrack=stream.getVideoTracks()[0];
            const audioTrack=stream.getAudioTracks()[0];
            //when you want to return an object inside otherwise treats it as a block of code
            setParams((present)=>({...present,videoTrack,audioTrack}));
        }

    }
    catch(e){
        console.log('error while starting camera')
        console.log(`cam error :${e} `)
    }
}
const getRouterRtpCapabilities=async()=>{
    socket.emit("getRouterCapabilities",(data)=>{
        setRtpCapabilities(data)
        console.log(`getRouterRtpCapbailities`,data)
    })
}
const createDevice=async()=>{
    try{
        const device=new Device();
        await device.load({routerRtpCapabilities:rtpCapabilities})
        setDevice(device)
        console.log("device created",device)
    }
    catch(err){
        console.log(`error during device creation ${err}`)
    }
}
const createSendTransport=async()=>{
    try{
        socket.emit("createTransport",{sender:true},({params})=>{
              let transport=device.createSendTransport(params);
               setProducerTransport(transport);
               transport?.on("connect",async({dtlsParameters},callback)=>{
                try
                {  
                    socket.emit("connectProducerTransport",{dtlsParameters},()=>{
                    console.log(callback.msg);
                    console.log("producer transport connected")
                    }  )
                }    
                catch(err){
                    console.log("error in createproducertranport")
                } 

            }    

                )
            transport?.on('produce',async ({ kind, rtpParameters }, callback, errback)=>{
                
                console.log("started transport produce");
                try{
                    socket.emit("transport-produce",{kind,rtpParameters},({id})=>{
                        console.log("produced id:",id);
                       

                    })

                }
                catch(error){
                    errback(error);
                }
            })
            })
        }
    
    catch(err){
        console.log("error during create send transport")
        
    }
}
const connectSendTrasnport=async()=>{
      if (!producerTransport) return console.log("Producer transport not ready");
    if (!params.videoTrack) return console.log("Video track not ready");

    let localproducer=await producerTransport.produce( 
  {  track: params.videoTrack,
    encodings: params.encoding,     
    codecOptions: params.codecOptions
}
);
    if (!localproducer) return console.log("Failed to produce media");

    localproducer?.on('trackended',()=>{
        console.log('track ended');
    })
    localproducer?.on('transportclose',()=>{
        console.log('tranport closed');
    })

}
const createReceiveTrasnport=async()=>{
    socket.emit('createTransport',{sender:false},({params})=>{
        if (params){
            console.log(params);
        }
        else{
            console.log(params.error);
        }
        let transport=device?.createRecvTransport(params)
     setConsumerTransport(transport);
     transport.on("connect",async({dtlsParameters},callback,errback)=>{
        try{
            socket.emit("createConsumerTransport",{dtlsParameters});
            console.log("consumer tranport connected");
            callback()


        }
        catch(error){
            console.log(errback(error));
        }

    })

    })
    
}
const connectReceiveTransport=async()=>{
    await socket.emit("consume-transport",{rtpCapabilities:device?.rtpCapabilities},async({parameters})=>{
        if(parameters.error){
            console.log(params.error);
            return;
        }
    let consumer=await consumerTransport.consume({
        id:parameters.id,
        producerId:parameters.producerId,
        kind:parameters.kind,
        rtpParameters:parameters.rtpParameters
    })
    const {track}=consumer;
    console.log(`track here consumer :${track}`);
    if (remoteVideoRef.current){
        remoteVideoRef.current.srcObject=new window.MediaStream([track]);
    }
    socket.emit("resumePausedConsumer",()=>{
        console.log("consumer transport has been resumed");
    })

    })

}

useEffect(()=>
{   const socket=io('http://localhost:5000')
    setSocket(socket);
    socket.on("connection:success",({socketId})=>{
        console.log(`client msg socket id : ${socketId}`);
        startCamera();
        setParams({
            encoding:[ 
                { rid: "r0", maxBitrate: 100000, scalabilityMode: "S1T3" }, // Lowest quality layer
                { rid: "r1", maxBitrate: 300000, scalabilityMode: "S1T3" }, // Middle quality layer
                { rid: "r2", maxBitrate: 900000, scalabilityMode: "S1T3" }, // Highest quality layer
            ],
            codecOptions:
            {
                videoGoogleStartBitrate:1000
            }

        })
    
    })
        //cleanup
    return ()=>{
        socket.disconnect()
    }
    
},[])

return (
    <>
    <div className='m-10 flex gap-10'>
    <div className='flex flex-col'>
    <h1> localvideo</h1>
    <video ref={localVideoRef} autoPlay playsInline width={300} height={300} className=" border-4 border-blue-400 bg-blue-200 rounded-sm shadow-lg "></video>
    </div>
    <div className='flex flex-col'>
    <h1>remotevideo</h1>
    <video ref={remoteVideoRef} autoPlay playsInline width={300} height={300} className=" border-4 border-blue-400 bg-blue-200 rounded-sm shadow-lg"></video>
    </div>
    </div>
    <div className='flex  gap-6'>
        <button className=' bg-blue-500 text-white  px-5 py-3 rounded-full cursor-pointer w-fit  inline-flex' onClick={getRouterRtpCapabilities}> 
            Get router rtpCapabilities
        </button> 
         <button className=' bg-blue-500 text-white  px-5 py-3 rounded-full cursor-pointer w-fit  inline-flex' onClick={createDevice}> 
           create Device
        </button>

         <button className=' bg-blue-500 text-white  px-5 py-3 rounded-full cursor-pointer w-fit  inline-flex' onClick={createSendTransport}> 
            create send Transport
        </button>

         <button className=' bg-blue-500 text-white  px-5 py-3 rounded-full cursor-pointer w-fit  inline-flex' onClick={connectSendTrasnport}> 
           connect send transport and produce media
        </button>

         <button className=' bg-blue-500 text-white  px-5 py-3 rounded-full cursor-pointer w-fit  inline-flex' onClick={createReceiveTrasnport}> 
        create receive transport
        </button>

        <button className=' bg-blue-500 text-white  px-5 py-3 rounded-full cursor-pointer w-fit  inline-flex' onClick={connectReceiveTransport}> 
        connect receive transport and consume media
     </button> 

    </div>
    </>
)


}
