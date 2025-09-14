import {useState,useEffect,useRef} from 'react';
import {io} from 'socket.io-client';
import {Device} from 'mediasoup-client'

export default function Home()
{

const [device,setDevice]=useState()
const  [params,setParams]=useState({})
const [socket,setSocket]=useState()
const [rtpCapabilities,setRtpCapabilities]=useState()
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

useEffect(()=>
{   const socket=io('http://localhost:5000',{
      transports: ['websocket','polling']
})
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
    </>
)
}



