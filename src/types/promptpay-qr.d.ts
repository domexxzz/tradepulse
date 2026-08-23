declare module "promptpay-qr" {
  export default function generatePayload(
    id: string,
    options?: { amount?: number }
  ): string;
}
