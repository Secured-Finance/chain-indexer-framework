import { LotusBlockGetter } from "../block_getters/lotus_block_getter.js";
import { BlockProducerError } from "../errors/block_producer_error.js";
import { IBlock } from "../interfaces/block.js";
import { IBlockSubscription } from "../interfaces/block_subscription.js";
import { IObserver } from "../interfaces/observer.js";
import { Logger } from "../logger/logger.js";

/**
 * A class to produce blocks based on polling
 * 
 * @class {LotusBlockPoller}
 */
export class LotusBlockPoller implements IBlockSubscription<IBlock, Error> {
    private pollingId?: number;

    /**
     * @constructor
     * 
     * @param {LotusBlockGetter} blockGetter - LotusBlockGetter module from web3.js
     * @param {number} blockPollingTimeout - The interval we have to poll for new blocks
     */
    constructor(private blockGetter: LotusBlockGetter, private blockPollingTimeout: number) { }

    /**
     * The method to start polling for blocks from the start block to finalized block
     *
     * @param {IObserver} observer - The observer object with his functions
     * @param {number} startBlock - Block number to start subscribing from.
     * 
     * @returns {Promise<void>}
     */
    public async subscribe(observer: IObserver<IBlock, Error>, startBlock: number): Promise<void> {
        try {
            this.pollingId = Date.now();

            //Need to separate the methods, so the subscribe method is not waiting
            //indefinitely for polling to finish.
            this.startBlockPolling(observer, startBlock, this.pollingId);
        } catch (error) {
            observer.error(
                BlockProducerError.createUnknown(error)
            );
        }
    }

    /**
     * Stops the block polling process and kills the active interval from setInterval.
     * 
     * @returns {Promise<boolean>}
     */
    public async unsubscribe(): Promise<boolean> {
        this.pollingId = undefined;
        return true;
    }

    private async startBlockPolling(observer: IObserver<IBlock, Error>, startBlock: number, pollingId: number): Promise<void> {
        try {
            let lastBlockNumber: number = startBlock - 1;

            while (this.pollingId === pollingId) {
                const latestBlockNumber = await this.blockGetter.getLatestBlockNumber();
                
                Logger.debug(`Starting polling from block number ${lastBlockNumber} and latest block number is ${latestBlockNumber}`);
                if (latestBlockNumber <= lastBlockNumber) {
                    await new Promise(r => setTimeout(r, this.blockPollingTimeout));
                }

                for (let blockNum: number = (lastBlockNumber + 1); blockNum <= latestBlockNumber && this.pollingId === pollingId; blockNum++) {
                    try {
                        const block = await this.blockGetter.getBlockWithTransactionReceipts(blockNum);

                        //Added below logic as if a new subscription is created before previous 
                        //promise was resolved, then the block is not emitted.
                        if (this.pollingId !== pollingId) {
                            break;
                        }
                        
                        observer.next(block);
                        lastBlockNumber = blockNum;                        
                    } catch (error) {
                        if (error instanceof Error) {
                            console.log("error.message:", error.message);
                            if (error.message === "Returned error: requested epoch was a null round") {
                                lastBlockNumber = blockNum;
                                Logger.warn(`The block number ${blockNum} is a null round. Skipping to the next block.`);
                            } else {
                                observer.error(
                                    BlockProducerError.createUnknown(error)
                                );
                            }
                        }
                    }

                }
            }

        } catch (error) {
            observer.error(
                BlockProducerError.createUnknown(error)
            );
        }
    }
}
