export default function handler(req: any, res: any) {
  console.log("Plain Node.js handler hit!");
  res.status(200).json({ status: "ok", type: "plain-node" });
}
