import fs from "fs";
import path from "path";
// @ts-ignore
import buildCalculator from "../zk/circuits/zkporc_js/witness_calculator";
import { buildBabyjub } from "circomlibjs";
import * as snarkjs from "snarkjs";

export class ZKPoRCClient {
  private _calculator: any;
  private _babyjub: any;
  private _zkey: any;

  get initialized() {
    return (
      this._calculator !== undefined &&
      this._babyjub !== undefined &&
      this._zkey !== undefined
    );
  }

  get calculator() {
    if (!this.initialized) throw Error("Not initialized");
    return this._calculator;
  }

  async init() {
    if (this.initialized) return this;
    const wasm = fs.readFileSync(
      path.join(__dirname, "../../zk/circuits/zkporc_js/zkporc.wasm")
    );
    [this._zkey, this._calculator, this._babyjub] = await Promise.all([
      new Promise((resolve, reject) =>
        fs.readFile(
          path.join(__dirname, "../../zk/zkeys/zkporc.zkey"),
          (err, data) => {
            if (err) reject(err);
            else resolve(data);
          }
        )
      ),
      buildCalculator(wasm),
      buildBabyjub(),
    ]);
    this._zkey.type = "mem";
    return this;
  }

  async proveRedeemCode(account: string, code: string) {
    const obj = JSON.parse(code);
    const inputs = {
      message: obj.msg,
      account: account,
      Ax: obj.pubKey.X,
      Ay: obj.pubKey.Y,
      sigS: obj.sig.S,
      sigR8x: obj.sig.R8.X,
      sigR8y: obj.sig.R8.Y,
    };
    const wtns = await this.calculator.calculateWTNSBin(inputs, 0);
    const { proof } = await snarkjs.groth16.prove(this._zkey, wtns);
    return {
      a: [proof.pi_a[0], proof.pi_a[1]] as [bigint, bigint],
      b: [proof.pi_b[0].reverse(), proof.pi_b[1].reverse()] as [
        [bigint, bigint],
        [bigint, bigint]
      ],
      c: [proof.pi_c[0], proof.pi_c[1]] as [bigint, bigint],
    };
  }
}
