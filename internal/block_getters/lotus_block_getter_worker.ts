import EthClass from "web3-eth";
import { parentPort, workerData } from "worker_threads";
import { IBlockWorkerMessage } from "../interfaces/block_worker_message.js";
import { LotusBlockGetter } from "./lotus_block_getter.js";

if (!workerData || !parentPort) {
    process.exit(1);
}

const blockGetter = new LotusBlockGetter(
    //@ts-ignore
    new EthClass(
        //@ts-ignore
        new EthClass.providers.WebsocketProvider(
            workerData.endpoint,
            {
                reconnect: {
                    auto: true
                },
                clientConfig: {
                    maxReceivedFrameSize: 1000000000,
                    maxReceivedMessageSize: 1000000000,
                },
                timeout: 45000
            }
        )
    ),
    workerData.maxRetries
);

parentPort.on("message", async (message: {
    blockNumber: number,
    callBackId: number
}) => {
    try {
        parentPort?.postMessage(
            {
                callBackId: message.callBackId,
                error: null,
                block: await blockGetter.getBlockWithTransactionReceipts(message.blockNumber)
            } as IBlockWorkerMessage
        );
    } catch (error) {
        parentPort?.postMessage(
            {
                callBackId: message.callBackId,
                error: error
            } as IBlockWorkerMessage
        );
    }
});
