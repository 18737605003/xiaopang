import { sm2 } from 'sm-crypto';
import fs from 'fs';
import path from 'path';

// 生成SM2密钥对
export function generateSM2KeyPair() {
  const keypair = sm2.generateKeyPairHex();
  
  return {
    privateKey: keypair.privateKey,
    publicKey: keypair.publicKey
  };
}

// 生成并输出密钥
const keyPair = generateSM2KeyPair();

console.log('=== SM2密钥对生成成功 ===\n');
console.log('私钥 (Private Key):');
console.log(keyPair.privateKey);
console.log('\n公钥 (Public Key):');
console.log(keyPair.publicKey);
console.log('\n========================\n');

// 保存到文件
const keysDir = path.join(process.cwd(), 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const privateKeyPath = path.join(keysDir, 'sm2_private.key');
const publicKeyPath = path.join(keysDir, 'sm2_public.key');

fs.writeFileSync(privateKeyPath, keyPair.privateKey, 'utf8');
fs.writeFileSync(publicKeyPath, keyPair.publicKey, 'utf8');

console.log(`私钥已保存到: ${privateKeyPath}`);
console.log(`公钥已保存到: ${publicKeyPath}`);

export default generateSM2KeyPair;
