jest.mock('../common/common.service', () => ({ CommonService: class {} }));
import { TxService } from './tx.service';
import { CatTxError } from '../../common/exceptions';
describe('native indexing failure and spent-update ordering', () => {
  let service: any, tx: any;
  beforeEach(() => {
    service = Object.create(TxService.prototype);
    service.logger = { log: jest.fn(), error: jest.fn() };
    service.commonService = {
      parseTaprootOutput: jest.fn(() => null),
      searchGuardOutputs: jest.fn(() => false),
      searchGuardInputs: jest.fn(() => []),
    };
    service.isCatTx = jest.fn(() => true);
    service.parseTaprootInput = jest.fn(() => null);
    service.updateSpent = jest.fn(async () => undefined);
    service.searchMinterInput = jest.fn(async () => ({
      minterInput: null,
      tokenInfo: null,
    }));
    service.processRevealTx = jest.fn(async () => []);
    service.saveTx = jest.fn(async () => undefined);
    tx = {
      isCoinbase: () => false,
      outs: [{}],
      ins: [{}],
      getId: () => 'a'.repeat(64),
    };
  });
  it('waits for spent updates before parsing or durable transaction state', async () => {
    let finish: () => void;
    service.updateSpent.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const processing = service.processTx(tx, 0, {});
    await Promise.resolve();
    expect(service.searchMinterInput).not.toHaveBeenCalled();
    expect(service.saveTx).not.toHaveBeenCalled();
    finish!();
    await processing;
    expect(service.saveTx).toHaveBeenCalledTimes(1);
  });
  it.each(['spent-update', 'native-parser', 'save'])(
    'propagates unexpected %s failure before block checkpoint advancement',
    async (failure) => {
      const error = new Error('controlled native failure');
      if (failure === 'spent-update')
        service.updateSpent.mockRejectedValue(error);
      if (failure === 'native-parser')
        service.processRevealTx.mockRejectedValue(error);
      if (failure === 'save') service.saveTx.mockRejectedValue(error);
      await expect(service.processTx(tx, 0, {})).rejects.toBe(error);
    },
  );
  it('retains explicit native invalid-transaction handling', async () => {
    service.processRevealTx.mockRejectedValue(
      new CatTxError('controlled invalid native transaction'),
    );
    await expect(service.processTx(tx, 0, {})).resolves.toBeUndefined();
    expect(service.saveTx).not.toHaveBeenCalled();
  });
});
