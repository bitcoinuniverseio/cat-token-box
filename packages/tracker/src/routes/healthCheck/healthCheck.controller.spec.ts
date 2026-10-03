import { HealthCheckController } from './healthCheck.controller';
jest.mock('../../services/common/common.service', () => ({
  CommonService: class {},
}));
describe('actual native tracker database checkpoint', () => {
  const hash = 'a'.repeat(64);
  const fork =
    '00000000000000005a5c13fe33f6717c7ad81fc8837ae75e4693c16acbdd0f66';
  let common: any;
  beforeEach(() => {
    common = {
      getBlockchainInfo: jest.fn(async () => ({
        chain: 'main',
        blocks: 100,
        headers: 100,
        initialblockdownload: false,
        bestblockhash: hash,
      })),
      getLastProcessedBlock: jest.fn(async () => ({ height: 100, hash })),
      getCanonicalBlockHash: jest.fn(async (height) =>
        height === 0
          ? '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'
          : height === 1
            ? fork
            : hash,
      ),
    };
  });
  it('returns database height/hash verified against the native node without a source revision claim', async () => {
    expect(await new HealthCheckController(common).checkHealth()).toEqual({
      code: 0,
      msg: 'OK',
      data: {
        network: 'fractal-mainnet',
        checkpoint: { height: 100, hash },
        trackerBlockHeight: 100,
        nodeBlockHeight: 100,
        latestBlockHeight: 100,
      },
    });
  });
  it.each([
    'missing-db',
    'foreign-db-hash',
    'wrong-fork',
    'ibd',
    'unsynchronized',
    'db-reorg',
    'tip-change',
  ])(
    'rejects %s without copying the node hash into a database proof',
    async (failure) => {
      if (failure === 'missing-db')
        common.getLastProcessedBlock.mockResolvedValue(null);
      if (failure === 'foreign-db-hash')
        common.getLastProcessedBlock.mockResolvedValue({
          height: 100,
          hash: 'b'.repeat(64),
        });
      if (failure === 'wrong-fork')
        common.getCanonicalBlockHash.mockResolvedValue(hash);
      if (failure === 'ibd')
        common.getBlockchainInfo.mockResolvedValue({
          chain: 'main',
          blocks: 100,
          headers: 100,
          initialblockdownload: true,
        });
      if (failure === 'unsynchronized')
        common.getBlockchainInfo.mockResolvedValue({
          chain: 'main',
          blocks: 100,
          headers: 101,
          initialblockdownload: false,
        });
      if (failure === 'db-reorg')
        common.getLastProcessedBlock
          .mockResolvedValueOnce({ height: 100, hash })
          .mockResolvedValue({ height: 99, hash });
      if (failure === 'tip-change')
        common.getBlockchainInfo
          .mockResolvedValueOnce({
            chain: 'main',
            blocks: 100,
            headers: 100,
            initialblockdownload: false,
            bestblockhash: hash,
          })
          .mockResolvedValue({ blocks: 101, bestblockhash: 'b'.repeat(64) });
      expect(
        await new HealthCheckController(common).checkHealth(),
      ).toMatchObject({ code: 100, data: null });
    },
  );
});
