import { NextResponse } from "next/server";
import { assertRequestBodySize } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { previewStudentImport } from "@/lib/server/student-import-service";
export async function POST(request:Request){try{assertSameOrigin(request);const admin=await requireAdministrator();assertRequestBodySize(request,21*1024*1024);const form=await request.formData();const file=form.get("file");if(!(file instanceof File))throw new ApiError("请选择 Excel 文件");if(file.size>20*1024*1024)throw new ApiError("Excel 文件不能超过 20MB",413);if(!file.name.toLowerCase().endsWith(".xlsx"))throw new ApiError("仅支持 .xlsx 文件");return NextResponse.json(await previewStudentImport(admin.id,file.name,await file.arrayBuffer()),{status:201})}catch(error){return apiErrorResponse(error,"学生账号预检失败")}}
