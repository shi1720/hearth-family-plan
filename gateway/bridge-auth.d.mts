export type BridgeUser = {
  uid: string;
  email: string;
  name?: string;
  isDemo: boolean;
  emailVerified: boolean;
};
export function digestBody(body?: Uint8Array): Promise<string>;
export function signBridgeRequest(
  request: Request,
  body: Uint8Array,
  user: BridgeUser,
  secret: string,
  now?: number,
): Promise<Record<string, string>>;
export function verifyBridgeRequest(
  request: Request,
  secret: string,
  now?: number,
): Promise<BridgeUser>;
