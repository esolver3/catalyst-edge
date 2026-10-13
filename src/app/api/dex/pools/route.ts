import { NextRequest, NextResponse } from "next/server";
import { fetchDexPools } from "../../../../lib/cmc-dex";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const platform=request.nextUrl.searchParams.get("platform")??"";
  const address=request.nextUrl.searchParams.get("address")??"";
  try {
    const snapshot=await fetchDexPools(platform,address,process.env.CMC_API_KEY);
    return NextResponse.json(snapshot,{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    const message=error instanceof Error?error.message:"DEX unavailable";
    const invalid=/Invalid|Unsupported/.test(message);
    return NextResponse.json({error:message},{status:invalid?400:502,headers:{"Cache-Control":"no-store"}});
  }
}
