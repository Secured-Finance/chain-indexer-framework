import { LotusBlockGetter } from "@internal/block_getters/lotus_block_getter.js";
import { BlockProducer } from "@internal/block_producers/block_producer.js";
import { IProducedBlock, IProducedBlocksModel, ProducedBlocksModel } from "@internal/block_producers/produced_blocks_model.js";
import { LotusBlockPoller } from "@internal/block_subscription/lotus_block_polling.js";
import { Coder } from "@internal/coder/protobuf_coder.js";
import { IBlockProducerConfig } from "@internal/interfaces/block_producer_config.js";
import { IProducerConfig } from "@internal/interfaces/producer_config.js";
import { Database } from "@internal/mongo/database.js";
import Eth from "web3-eth";

/**
 * Lotus block Poller producer class for FEVM which retrieves block from polling every block
 * for producing to kafka.
 *  
 */
export class LotusBlockPollerProducer extends BlockProducer {
    /**
     * @constructor
     * 
     * @param {IBlockProducerConfig} config
     * 
     * @returns {LotusBlockPollerProducer}
     */
    constructor(config: IBlockProducerConfig) {
        const endpoint = config.rpcWsEndpoints?.[0] ?? "";
        const startBlock = config.startBlock ?? 0;
        const mongoUrl = config.mongoUrl ?? "mongodb://localhost:27017/chain-indexer";
        const dbCollection = config.dbCollection ?? "producedblocks";
        const blockPollingTimeout = config.blockPollingTimeout ?? 2000;
        const maxRetries = config.maxRetries ?? 0;
        const maxReOrgDepth = config.maxReOrgDepth ?? 0;

        delete config.rpcWsEndpoints;
        delete config.startBlock;
        delete config.mongoUrl;
        delete config.dbCollection;
        delete config.maxReOrgDepth;
        delete config.maxRetries;
        delete config.blockPollingTimeout;

        const database = new Database(mongoUrl);

        const blockGetter = new LotusBlockGetter(
            //@ts-ignore
            new Eth(endpoint),
            maxRetries
        );

        super(
            new Coder(
                "fevm_block",
                "blockpackage",
                "FEVMBlock"
            ),
            config as IProducerConfig,
            new LotusBlockPoller(
                blockGetter,
                blockPollingTimeout
            ),
            blockGetter,
            database,
            database.model<IProducedBlock, IProducedBlocksModel<IProducedBlock>>(
                "ProducedBlocks",
                ProducedBlocksModel,
                dbCollection
            ),
            startBlock,
            maxReOrgDepth
        );
    }
}
