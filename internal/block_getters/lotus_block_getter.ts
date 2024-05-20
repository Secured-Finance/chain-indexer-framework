import { BlockTransactionObject, TransactionReceipt } from "web3-eth";
import { IBlock } from "../interfaces/block.js";
import { ITransaction } from "../interfaces/transaction.js";
import { ITransactionReceipt } from "../interfaces/transaction_receipt.js";
import { IWeb3Transaction } from "../interfaces/web3_transaction.js";
import { Logger } from "../logger/logger.js";
import { BlockGetter } from "./block_getter.js";

/**
 * A extended class of BlockGetter to get blocks from lotus nodes.
 * 
 * @author - Akihiro Tanaka
 */
export class LotusBlockGetter extends BlockGetter { 
    /**
     * @async
     * Public method to query block data including transaction receipts of a single block.
     * 
     * @param {number | string} blockNumber - The block number for which block data needs to be retrieved. 
     * 
     * @returns {Promise<IBlock>} - Block object containing all details including transaction receipts.
     * 
     * @throws {Error} - Throws error object on failure.
     */
    public async getBlockWithTransactionReceipts(blockNumber: number | string): Promise<IBlock> {
        const block: BlockTransactionObject = await this.eth.getBlock(blockNumber, true);
        Logger.debug(`Fetching transaction receipts for the following block ${block.number}`);

        const transactions: ITransaction[] = [];

        for (const transactionObject of block.transactions) {
            const transactionReceipt = await this.getLotusTransactionReceipt(transactionObject.hash);
            if(transactionReceipt) {
              transactions.push(
                  this.formatTransactionObject(
                      transactionObject as IWeb3Transaction,
                      transactionReceipt
                  )
              );
            }
        }

        return this.formatBlockWithTransactions(
            block,
            transactions
        );
    }


    /**
     * @async
     * This internal method retrieves the Lotus transaction receipt of the given transaction hash and retries upto retryLimit on failure. 
     * 
     * @param {string} transactionHash - The transaction hash for which transaction receipt is to be retrieved.  
     * @param {number} errorCount - Parameter for the function to know the number of times query has been retried. 
     * This parameter must ideally not be set by an external call. 
     * 
     * @returns {Promise<ITransactionReceipt>} - The transaction receipt of the given transaction hash. On failure throws error object. 
     * 
     * @throws {Error} - Throws error object on failure.
     */
    protected async getLotusTransactionReceipt(transactionHash: string, errorCount: number = 0): Promise<ITransactionReceipt | undefined> {
        try {
            const transactionReceipt: TransactionReceipt = await this.eth.getTransactionReceipt(transactionHash);

            if (transactionReceipt === null) {
                return;
            }

            return this.formatTransactionReceipt(transactionReceipt);
        } catch (error) {
            if (errorCount >= this.maxRetries) {
                throw error;
            }

            return this.getLotusTransactionReceipt(transactionHash, errorCount + 1);
        }
    }
}
