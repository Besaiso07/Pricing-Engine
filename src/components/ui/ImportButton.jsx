import { useRef } from 'react'
import Papa from 'papaparse'
import { Upload } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ImportButton({ onRows, label = 'Import CSV' }) {
  const ref = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (res) => {
        if (res.errors.length) {
          toast.error('CSV parse error: ' + res.errors[0].message)
          return
        }
        if (!res.data.length) {
          toast.error('No rows found in CSV')
          return
        }
        onRows(res.data)
      },
      error: (err) => toast.error('Failed to read file: ' + err.message),
    })
    e.target.value = '' // reset so same file can be re-imported
  }

  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg font-medium transition-colors px-4 py-2 text-sm bg-transparent border border-border text-slate-300 hover:bg-border/50"
      >
        <Upload size={15} /> {label}
      </button>
      <input ref={ref} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
    </>
  )
}
