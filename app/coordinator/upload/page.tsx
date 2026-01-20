"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { Upload, RefreshCw, FileText, ArrowLeft, FileSpreadsheet } from "lucide-react"
import { getCoordinatorEventId } from "@/components/EventSelector"
import * as XLSX from "xlsx"

// Database field options for mapping
const DB_FIELDS = [
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "organization", label: "Organization Name", required: true },
  { value: "title", label: "Title" },
  { value: "phone", label: "Phone", required: false },
  { value: "email", label: "Email", required: false },
  { value: "floatDescription", label: "Float Description", required: false },
  { value: "entryLength", label: "Entry Length" },
  { value: "typeOfEntry", label: "Type of Entry" },
  { value: "hasMusic", label: "Has Music" },
  { value: "comments", label: "Comments" },
  { value: "floatNumber", label: "Float Number" },
]

function getAdminPassword(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return authCookie ? authCookie.split("=")[1] : null
}

export default function CoordinatorUploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<'csv' | 'xlsx'>('csv')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [fieldMapping, setFieldMapping] = useState<{ [csvHeader: string]: string }>({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [firstRowIsHeaders, setFirstRowIsHeaders] = useState(true)
  const [showVerification, setShowVerification] = useState(false)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)

  const parseCSVFile = async (file: File, useFirstRowAsHeaders: boolean) => {
    try {
      const text = await file.text()
      
      if (!text.trim()) {
        toast.error("CSV file is empty")
        return null
      }

      // Robust CSV parser that handles:
      // - Multi-line quoted fields
      // - Escaped quotes ("")
      // - Mixed line endings (\r\n, \n, \r)
      const parseCSV = (csvText: string): string[][] => {
        const rows: string[][] = []
        let currentRow: string[] = []
        let currentCell = ''
        let inQuotes = false
        
        for (let i = 0; i < csvText.length; i++) {
          const char = csvText[i]
          const nextChar = csvText[i + 1]
          
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Escaped quote ("") - add single quote and skip next
              currentCell += '"'
              i++
            } else {
              // Toggle quote state
              inQuotes = !inQuotes
            }
          } else if (char === ',' && !inQuotes) {
            // End of cell
            currentRow.push(currentCell.trim())
            currentCell = ''
          } else if ((char === '\n' || char === '\r') && !inQuotes) {
            // End of row (handle \r\n, \n, or \r)
            if (char === '\r' && nextChar === '\n') {
              i++ // Skip the \n
            }
            if (currentCell || currentRow.length > 0) {
              currentRow.push(currentCell.trim())
              if (currentRow.some(cell => cell)) { // Only add non-empty rows
                rows.push(currentRow)
              }
              currentRow = []
              currentCell = ''
            }
          } else {
            currentCell += char
          }
        }
        
        // Add last row if exists
        if (currentCell || currentRow.length > 0) {
          currentRow.push(currentCell.trim())
          if (currentRow.some(cell => cell)) {
            rows.push(currentRow)
          }
        }
        
        return rows
      }

      // Parse all rows
      const allRows = parseCSV(text)
      
      if (allRows.length === 0) {
        toast.error("No data found in CSV file")
        return null
      }
      
      // Determine headers based on firstRowIsHeaders setting
      let headers: string[]
      let dataRows: string[][]
      
      if (useFirstRowAsHeaders && allRows.length > 0) {
        headers = allRows[0]
        dataRows = allRows.slice(1)
      } else {
        // Use column letters (A, B, C, etc.) as headers
        const maxColumns = Math.max(...allRows.map(row => row.length), 0)
        headers = Array.from({ length: maxColumns }, (_, i) => {
          let colName = ''
          let num = i
          while (num >= 0) {
            colName = String.fromCharCode(65 + (num % 26)) + colName
            num = Math.floor(num / 26) - 1
          }
          return `Column ${colName}`
        })
        dataRows = allRows
      }

      return { headers, dataRows }
    } catch (error) {
      console.error("Error parsing CSV:", error)
      toast.error("Failed to parse CSV file")
      return null
    }
  }

  // Parse XLSX file using SheetJS
  const parseXLSXFile = async (file: File, sheetName?: string, useFirstRowAsHeaders: boolean = true) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      
      // Store workbook for sheet selection
      setWorkbook(wb)
      setSheetNames(wb.SheetNames)
      
      // Use specified sheet or first sheet
      const targetSheet = sheetName || wb.SheetNames[0]
      if (!selectedSheet && !sheetName) {
        setSelectedSheet(targetSheet)
      }
      
      const worksheet = wb.Sheets[targetSheet]
      if (!worksheet) {
        toast.error(`Sheet "${targetSheet}" not found`)
        return null
      }
      
      // Convert to array of arrays
      const allRows: string[][] = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: '', // Use empty string for empty cells
        blankrows: false // Skip completely blank rows
      })
      
      if (allRows.length === 0) {
        toast.error("Spreadsheet is empty")
        return null
      }
      
      // Clean up rows - convert all values to strings and trim
      const cleanedRows = allRows.map(row => 
        row.map(cell => String(cell ?? '').trim())
      ).filter(row => row.some(cell => cell)) // Remove empty rows
      
      // Determine headers
      let headers: string[]
      let dataRows: string[][]
      
      if (useFirstRowAsHeaders && cleanedRows.length > 0) {
        headers = cleanedRows[0]
        dataRows = cleanedRows.slice(1)
      } else {
        const maxColumns = Math.max(...cleanedRows.map(row => row.length), 0)
        headers = Array.from({ length: maxColumns }, (_, i) => {
          let colName = ''
          let num = i
          while (num >= 0) {
            colName = String.fromCharCode(65 + (num % 26)) + colName
            num = Math.floor(num / 26) - 1
          }
          return `Column ${colName}`
        })
        dataRows = cleanedRows
      }
      
      return { headers, dataRows }
    } catch (error) {
      console.error("Error parsing XLSX:", error)
      toast.error("Failed to parse Excel file")
      return null
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const isCSV = selectedFile.name.toLowerCase().endsWith('.csv')
    const isXLSX = selectedFile.name.toLowerCase().endsWith('.xlsx') || selectedFile.name.toLowerCase().endsWith('.xls')

    if (!isCSV && !isXLSX) {
      toast.error("Please select a CSV or Excel (.xlsx) file")
      return
    }

    setFile(selectedFile)
    setFileType(isXLSX ? 'xlsx' : 'csv')
    setWorkbook(null)
    setSheetNames([])
    setSelectedSheet('')
    setShowVerification(false)

    try {
      const result = isXLSX 
        ? await parseXLSXFile(selectedFile, undefined, firstRowIsHeaders)
        : await parseCSVFile(selectedFile, firstRowIsHeaders)
      if (!result) return
      
      const { headers, dataRows } = result
      setCsvHeaders(headers)
      setCsvRows(dataRows)

      // Auto-map common field names (only if first row is headers)
      const autoMapping: { [key: string]: string } = {}
      if (firstRowIsHeaders) {
        headers.forEach((header) => {
          const lowerHeader = header.toLowerCase().trim()
          
          // Try to match common variations
          if (lowerHeader.includes('first') && lowerHeader.includes('name')) {
            autoMapping[header] = 'firstName'
          } else if (lowerHeader.includes('last') && lowerHeader.includes('name')) {
            autoMapping[header] = 'lastName'
          } else if (lowerHeader.includes('organization') || lowerHeader.includes('org name')) {
            autoMapping[header] = 'organization'
          } else if (lowerHeader === 'title' || (lowerHeader.includes('title') && !lowerHeader.includes('entry'))) {
            autoMapping[header] = 'title'
          } else if (lowerHeader.includes('phone')) {
            autoMapping[header] = 'phone'
          } else if (lowerHeader.includes('email')) {
            autoMapping[header] = 'email'
          } else if (lowerHeader.includes('float description') || (lowerHeader.includes('description') && !lowerHeader.includes('entry'))) {
            autoMapping[header] = 'floatDescription'
          } else if (lowerHeader.includes('entry length') || lowerHeader === 'length') {
            autoMapping[header] = 'entryLength'
          } else if (lowerHeader.includes('type of entry') || lowerHeader.includes('entry type')) {
            autoMapping[header] = 'typeOfEntry'
          } else if (lowerHeader.includes('music')) {
            autoMapping[header] = 'hasMusic'
          } else if (lowerHeader.includes('comment')) {
            autoMapping[header] = 'comments'
          } else if (lowerHeader.includes('sequence') || lowerHeader.includes('order') || lowerHeader.includes('float number') || lowerHeader === '#') {
            autoMapping[header] = 'floatNumber'
          }
        })
      }

      setFieldMapping(autoMapping)
      toast.success(`Loaded ${dataRows.length} rows from ${fileType === 'xlsx' ? 'Excel' : 'CSV'} file`)
    } catch (error) {
      console.error("Error parsing CSV:", error)
      toast.error("Failed to parse CSV file")
    }
  }

  const handleHeaderToggle = async (newValue: boolean) => {
    setFirstRowIsHeaders(newValue)
    // Re-parse with new setting
    if (file) {
      try {
        const result = fileType === 'xlsx' 
          ? await parseXLSXFile(file, selectedSheet || undefined, newValue)
          : await parseCSVFile(file, newValue)
        if (result) {
          const { headers, dataRows } = result
          setCsvHeaders(headers)
          setCsvRows(dataRows)
          
          // Re-run auto-mapping if headers changed
          const autoMapping: { [key: string]: string } = {}
          if (newValue) {
            headers.forEach((header) => {
              const lowerHeader = header.toLowerCase().trim()
              if (lowerHeader.includes('first') && lowerHeader.includes('name')) {
                autoMapping[header] = 'firstName'
              } else if (lowerHeader.includes('last') && lowerHeader.includes('name')) {
                autoMapping[header] = 'lastName'
              } else if (lowerHeader.includes('organization') || lowerHeader.includes('org name')) {
                autoMapping[header] = 'organization'
              } else if (lowerHeader === 'title' || (lowerHeader.includes('title') && !lowerHeader.includes('entry'))) {
                autoMapping[header] = 'title'
              } else if (lowerHeader.includes('phone')) {
                autoMapping[header] = 'phone'
              } else if (lowerHeader.includes('email')) {
                autoMapping[header] = 'email'
              } else if (lowerHeader.includes('float description') || (lowerHeader.includes('description') && !lowerHeader.includes('entry'))) {
                autoMapping[header] = 'floatDescription'
              } else if (lowerHeader.includes('entry length') || lowerHeader === 'length') {
                autoMapping[header] = 'entryLength'
              } else if (lowerHeader.includes('type of entry') || lowerHeader.includes('entry type')) {
                autoMapping[header] = 'typeOfEntry'
              } else if (lowerHeader.includes('music')) {
                autoMapping[header] = 'hasMusic'
              } else if (lowerHeader.includes('comment')) {
                autoMapping[header] = 'comments'
              } else if (lowerHeader.includes('sequence') || lowerHeader.includes('order') || lowerHeader.includes('float number') || lowerHeader === '#') {
                autoMapping[header] = 'floatNumber'
              }
            })
          }
          setFieldMapping(autoMapping)
        }
      } catch (error) {
        console.error("Error re-parsing file:", error)
      }
    }
  }

  const handleUpload = async () => {
    if (!file || csvRows.length === 0) {
      toast.error("Please select and parse a file first")
      return
    }

    // Validate required field mappings - only organization is truly required
    const requiredFields = ['organization'] // Only organization is required
    const mappedFields = Object.values(fieldMapping)
    
    for (const requiredField of requiredFields) {
      if (!mappedFields.includes(requiredField)) {
        toast.error(`Required field "${DB_FIELDS.find(f => f.value === requiredField)?.label}" is not mapped`)
        return
      }
    }

    setUploading(true)
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      // Get selected event ID
      const eventId = getCoordinatorEventId()

      // Prepare data for upload
      const entries = csvRows.map((row) => {
        const entry: any = {
          approved: true, // Auto-approve CSV uploads
        }

        // Add eventId if available
        if (eventId) {
          entry.eventId = eventId
        }

        csvHeaders.forEach((header, index) => {
          const dbField = fieldMapping[header]
          if (dbField) {
            // Always include the field, even if empty, so validation knows it exists
            const rawValue = row[index] || ''
            const value = rawValue.trim()
            
            if (dbField === 'hasMusic') {
              // Handle music field - convert various formats to boolean
              const lowerValue = value.toLowerCase()
              entry[dbField] = lowerValue === 'yes' || lowerValue === 'true' || lowerValue === '1' || lowerValue === '[""Yes""]'
            } else if (dbField === 'floatNumber') {
              // Handle float number - parse as integer
              const num = parseInt(value, 10)
              entry[dbField] = isNaN(num) ? null : num
            } else {
              // Include field even if empty (use empty string, not null, so validation sees it exists)
              entry[dbField] = value
            }
          }
        })

        return entry
      })

      // Upload entries
      const response = await fetch(`/api/coordinator/upload?password=${encodeURIComponent(password)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entries }),
      })

      if (response.status === 401) {
        router.push("/coordinator")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to upload entries")
        return
      }

      const result = await response.json()
      toast.success(`Successfully uploaded ${result.successCount} entries`)
      
      // Reset form
      setFile(null)
      setCsvHeaders([])
      setCsvRows([])
      setFieldMapping({})
      setShowVerification(false)
      
      // Redirect to positions page
      setTimeout(() => {
        router.push("/coordinator/positions")
      }, 1500)
    } catch (error) {
      console.error("Error uploading entries:", error)
      toast.error("Failed to upload entries")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#DC2626" }}>
              Upload Entries
            </h1>
            <p className="text-muted-foreground">
              Upload a CSV or Excel (.xlsx) file to bulk import parade entries
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/admin")}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Admin
            </Button>
            <Button
              onClick={() => router.push("/coordinator/approve")}
              variant="outline"
            >
              Approve Entries
            </Button>
            <Button
              onClick={() => router.push("/coordinator/positions")}
              variant="outline"
            >
              Manage Positions
            </Button>
          </div>
        </div>

        <Card className="p-6 space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select File (CSV or Excel)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#DC2626] file:text-white hover:file:bg-[#DC2626]/90"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {fileType === 'xlsx' ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  {file.name}
                </div>
              )}
            </div>
            
            {/* Sheet Selector for XLSX files */}
            {fileType === 'xlsx' && sheetNames.length > 1 && (
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Select Sheet</label>
                <select
                  value={selectedSheet}
                  onChange={async (e) => {
                    const newSheet = e.target.value
                    setSelectedSheet(newSheet)
                    if (file) {
                      const result = await parseXLSXFile(file, newSheet, firstRowIsHeaders)
                      if (result) {
                        setCsvHeaders(result.headers)
                        setCsvRows(result.dataRows)
                      }
                    }
                  }}
                  className="block w-full max-w-xs px-3 py-2 border rounded-md text-sm"
                >
                  {sheetNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Field Mapping */}
          {csvHeaders.length > 0 && !showVerification && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Map CSV Columns to Database Fields</h2>
                  <p className="text-sm text-muted-foreground">
                    Select a database field for each CSV column. Required fields are marked with <span className="text-red-500">*</span>.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={firstRowIsHeaders}
                      onChange={(e) => handleHeaderToggle(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">First row is headers</span>
                  </label>
                </div>
              </div>

              {/* Database Fields with Mapping */}
              <div>
                <h3 className="text-lg font-semibold mb-3 pb-2 border-b">Database Fields</h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {DB_FIELDS.map((field) => {
                    const mappedHeaders = csvHeaders.filter(h => fieldMapping[h] === field.value)
                    return (
                      <div
                        key={field.value}
                        className={`p-4 rounded-md border-2 transition-colors ${
                          mappedHeaders.length > 0
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                            : field.required
                            ? "border-red-200 bg-red-50 dark:bg-red-950"
                            : "border-gray-200 bg-white dark:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </span>
                          {mappedHeaders.length > 0 && (
                            <span className="text-xs px-2 py-1 rounded bg-blue-500 text-white">
                              {mappedHeaders.length} column{mappedHeaders.length > 1 ? 's' : ''} mapped
                            </span>
                          )}
                        </div>
                        <select
                          value={mappedHeaders[0] || ""}
                          onChange={(e) => {
                            const newMapping = { ...fieldMapping }
                            // Remove old mapping for this field
                            Object.keys(newMapping).forEach(key => {
                              if (newMapping[key] === field.value) {
                                delete newMapping[key]
                              }
                            })
                            // Add new mapping
                            if (e.target.value) {
                              newMapping[e.target.value] = field.value
                            }
                            setFieldMapping(newMapping)
                          }}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">-- Select CSV column --</option>
                          {csvHeaders.map((header, index) => {
                            const sampleValue = csvRows.length > 0 && csvRows[0][index] 
                              ? csvRows[0][index].substring(0, 40)
                              : ""
                            const isMapped = !!(fieldMapping[header] && fieldMapping[header] !== field.value)
                            return (
                              <option 
                                key={header} 
                                value={header}
                                disabled={isMapped}
                              >
                                {header}
                                {sampleValue && ` (${sampleValue}${csvRows[0][index].length > 40 ? "..." : ""})`}
                                {isMapped && " [Already mapped]"}
                              </option>
                            )
                          })}
                        </select>
                        {mappedHeaders.length > 1 && (
                          <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                            ⚠️ Multiple CSV columns mapped to this field. Only the first will be used.
                          </div>
                        )}
                        {mappedHeaders.length > 0 && csvRows.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Sample value: {csvRows[0][csvHeaders.indexOf(mappedHeaders[0])]?.substring(0, 60)}
                            {csvRows[0][csvHeaders.indexOf(mappedHeaders[0])]?.length > 60 ? "..." : ""}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Verify Button */}
              <div className="mt-6 pt-6 border-t">
                <Button
                  onClick={() => {
                    // Validate required fields
                    const requiredFields = DB_FIELDS.filter(f => f.required).map(f => f.value)
                    const mappedFields = Object.values(fieldMapping)
                    const missingFields = requiredFields.filter(f => !mappedFields.includes(f))
                    
                    if (missingFields.length > 0) {
                      toast.error(`Please map all required fields: ${missingFields.map(f => DB_FIELDS.find(df => df.value === f)?.label).join(", ")}`)
                      return
                    }
                    
                    setShowVerification(true)
                  }}
                  className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
                  size="lg"
                >
                  Verify Mapping
                </Button>
              </div>
            </div>
          )}

          {/* Verification View */}
          {showVerification && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Verify Mapping</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Review your mapping before uploading. You can go back to make changes.
              </p>

              <div className="space-y-3 mb-6">
                {DB_FIELDS.filter(field => {
                  const mappedHeaders = csvHeaders.filter(h => fieldMapping[h] === field.value)
                  return mappedHeaders.length > 0
                }).map((field) => {
                  const mappedHeaders = csvHeaders.filter(h => fieldMapping[h] === field.value)
                  const headerIndex = csvHeaders.indexOf(mappedHeaders[0])
                  return (
                    <div key={field.value} className="p-4 border rounded-md bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            ← {mappedHeaders[0]}
                            {csvRows.length > 0 && csvRows[0][headerIndex] && (
                              <span className="ml-2">
                                (Sample: {csvRows[0][headerIndex].substring(0, 50)}
                                {csvRows[0][headerIndex].length > 50 ? "..." : ""})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Preview Table */}
              {csvRows.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Preview (First 3 Rows)</h3>
                  <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted border-b">
                          {csvHeaders.map((header) => {
                            const mappedField = fieldMapping[header]
                            const dbField = DB_FIELDS.find(f => f.value === mappedField)
                            return (
                              <th key={header} className="text-left p-2 border-r">
                                <div className="font-medium">{header}</div>
                                {dbField && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    → {dbField.label}
                                  </div>
                                )}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 3).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="p-2 border-r text-muted-foreground">
                                {cell.substring(0, 50)}{cell.length > 50 ? "..." : ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowVerification(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
                  size="lg"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {csvRows.length} Entries
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

