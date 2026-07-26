import { describe, expect, it } from "vitest";
import { findWorkbookDuplicates, normalizeStudentImportRow, parseImportBoolean, parseImportDate, validateStudentImportRow } from "@/lib/domain/student-import";

const row = { username:"excel-student",displayName:"李同学",nationalId:"11010519491231002X",school:"示例中学",grade:"GRADE_7",phone:"13800138000",initialPassword:"Student2026",enabled:"是",validFrom:"",validUntil:"",isLongTerm:"否" };
const context = { businessDate:"2026-07-26", grades:[{id:"g7",code:"GRADE_7",name:"七年级",enabled:true}], existingUsernames:new Set<string>(), existingNationalIdHashes:new Set<string>(), existingPhoneHashes:new Set<string>(), hashSensitiveValue:(value:string)=>`hash:${value}` };

describe("student import rules",()=>{
  it.each([["是",true],["启用",true],["1",true],["否",false],["停用",false],["0",false]])("parses boolean %s",(value,expected)=>expect(parseImportBoolean(value)).toBe(expected));
  it("parses Excel and ISO dates",()=>{expect(parseImportDate(new Date("2026-08-01T00:00:00Z"))).toBe("2026-08-01");expect(parseImportDate("2026-08-02")).toBe("2026-08-02");expect(parseImportDate(46229)).toBe("2026-07-26")});
  it("normalizes a valid row with default validity and derived gender",()=>{const normalized=normalizeStudentImportRow(row,context.businessDate);expect(normalized).toMatchObject({enabled:true,isLongTerm:false,validFrom:"2026-07-26",validUntil:"2027-07-26",gender:"FEMALE"})});
  it("matches grade code or unique name and validates the row",()=>expect(validateStudentImportRow(row,context)).toMatchObject({valid:true,row:{gradeId:"g7"}}));
  it("rejects end without start, disabled grade and weak password",()=>{expect(validateStudentImportRow({...row,validUntil:"2027-01-01"},context).valid).toBe(false);expect(validateStudentImportRow({...row,grade:"八年级",initialPassword:"weak"},{...context,grades:[{id:"g8",code:"GRADE_8",name:"八年级",enabled:false}]}).valid).toBe(false)});
  it("finds duplicates across sheets",()=>{const rows=[{sheetName:"A",sourceRowNumber:2,row:normalizeStudentImportRow(row,context.businessDate)},{sheetName:"B",sourceRowNumber:3,row:normalizeStudentImportRow({...row,phone:"13900139000"},context.businessDate)}];expect(findWorkbookDuplicates(rows)).toEqual(expect.arrayContaining([expect.objectContaining({field:"username"}),expect.objectContaining({field:"nationalId"})]))});
});
