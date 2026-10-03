import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { errorResponse, okResponse } from '../../common/utils';
import { CommonService } from '../../services/common/common.service';

@Controller()
export class HealthCheckController {
  constructor(private readonly commonService: CommonService) {}

  @Get()
  @ApiTags('info')
  @ApiOperation({ summary: 'Check the health of the service' })
  async checkHealth() {
    try {
      const blockchainInfo = await this.commonService.getBlockchainInfo();
      const checkpoint = await this.commonService.getLastProcessedBlock();
      if (
        !checkpoint ||
        !Number.isSafeInteger(checkpoint.height) ||
        checkpoint.height < 0 ||
        !/^[a-f0-9]{64}$/.test(checkpoint.hash)
      )
        throw new Error('Tracker checkpoint unavailable');
      if (
        !blockchainInfo ||
        !Number.isSafeInteger(blockchainInfo.blocks) ||
        blockchainInfo.blocks < 1 ||
        !Number.isSafeInteger(blockchainInfo.headers) ||
        !/^[a-f0-9]{64}$/.test(blockchainInfo.bestblockhash || '') ||
        blockchainInfo.initialblockdownload !== false ||
        blockchainInfo.blocks !== blockchainInfo.headers ||
        checkpoint.height > blockchainInfo.blocks ||
        (await this.commonService.getCanonicalBlockHash(checkpoint.height)) !==
          checkpoint.hash
      )
        throw new Error('Tracker checkpoint is not canonical');
      const fork = await this.commonService.getCanonicalBlockHash(1);
      const network =
        blockchainInfo.chain === 'main' &&
        fork ===
          '00000000000000005a5c13fe33f6717c7ad81fc8837ae75e4693c16acbdd0f66'
          ? 'fractal-mainnet'
          : blockchainInfo.chain === 'test' &&
              fork ===
                '000000000021b22bb6a9718e5db62fca1eb2ac6e34535e70c67b374dcb29c570'
            ? 'fractal-testnet'
            : null;
      if (
        !network ||
        (await this.commonService.getCanonicalBlockHash(0)) !==
          '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'
      )
        throw new Error('Tracker native network is not qualified');
      const current = await this.commonService.getBlockchainInfo();
      const currentCheckpoint =
        await this.commonService.getLastProcessedBlock();
      if (
        current.initialblockdownload !== false ||
        current.chain !== blockchainInfo.chain ||
        current.headers !== current.blocks ||
        current.blocks !== blockchainInfo.blocks ||
        current.bestblockhash !== blockchainInfo.bestblockhash ||
        currentCheckpoint?.hash !== checkpoint.hash ||
        currentCheckpoint?.height !== checkpoint.height ||
        (await this.commonService.getCanonicalBlockHash(checkpoint.height)) !==
          checkpoint.hash
      )
        throw new Error('Tracker checkpoint changed during observation');
      return okResponse({
        network,
        checkpoint: { height: checkpoint.height, hash: checkpoint.hash },
        trackerBlockHeight: checkpoint.height,
        nodeBlockHeight: blockchainInfo?.blocks || null,
        latestBlockHeight: blockchainInfo?.headers || null,
      });
    } catch (e) {
      return errorResponse(e);
    }
  }
}
