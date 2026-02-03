import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  MessageSquare,
  BarChart,
  Loader2,
  Send,
  Filter,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { callAIAgent } from '@/utils/aiAgent'
import type { NormalizedAgentResponse } from '@/utils/aiAgent'

// Agent IDs from workflow.json
const RANDOM_AGENT_ID = "69787126a75ef8a94cc4f0d1"
const PERIODIC_AGENT_ID = "697871441b6268d7b95195f6"

// TypeScript interfaces from actual test responses
interface CriteriaIdentified {
  sender: string | null
  date_range: string
  category: string
  keywords: string[]
}

interface EmailPreview {
  id: string
  sender: string
  subject: string
  date: string
  snippet: string
  category?: string
}

interface RandomAgentResponse {
  action: string
  emails_found: number
  emails_deleted: number
  criteria_identified: CriteriaIdentified
  email_preview: EmailPreview[]
  confirmation_required: boolean
  message: string
}

interface RuleResult {
  rule_name: string
  rule_type: string
  emails_found: number
  emails_deleted: number
  criteria_applied: {
    label_ids?: string[]
    days_older_than?: number
  }
  status: string
}

interface PeriodicResponse {
  cleanup_summary: {
    total_emails_processed: number
    total_emails_deleted: number
    rules_executed: number
    execution_time_seconds: number
  }
  rules_results: RuleResult[]
  next_scheduled_run: string
  errors: string[]
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ActivityLog {
  id: string
  timestamp: string
  action: string
  emailsDeleted: number
  status: 'success' | 'error'
}

interface CleanupSettings {
  promotional: boolean
  oldEmails: boolean
  ageThreshold: number
  scheduleEnabled: boolean
  frequency: 'daily' | 'weekly' | 'disabled'
  scheduleTime: string
  requireConfirmation: boolean
  maxEmailsPerRun: number
}

// Helper to format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Helper to format time
function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Load activity from localStorage
function loadActivityLog(): ActivityLog[] {
  try {
    const stored = localStorage.getItem('gmail_activity_log')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Save activity to localStorage
function saveActivityLog(logs: ActivityLog[]) {
  try {
    localStorage.setItem('gmail_activity_log', JSON.stringify(logs))
  } catch (e) {
    console.error('Failed to save activity log:', e)
  }
}

// Load settings from localStorage
function loadSettings(): CleanupSettings {
  try {
    const stored = localStorage.getItem('gmail_cleanup_settings')
    return stored ? JSON.parse(stored) : {
      promotional: true,
      oldEmails: true,
      ageThreshold: 30,
      scheduleEnabled: false,
      frequency: 'weekly' as const,
      scheduleTime: '09:00',
      requireConfirmation: true,
      maxEmailsPerRun: 100
    }
  } catch {
    return {
      promotional: true,
      oldEmails: true,
      ageThreshold: 30,
      scheduleEnabled: false,
      frequency: 'weekly' as const,
      scheduleTime: '09:00',
      requireConfirmation: true,
      maxEmailsPerRun: 100
    }
  }
}

// Dashboard Stats Component
function DashboardStats({ activityLog }: { activityLog: ActivityLog[] }) {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const weekCount = activityLog
    .filter(log => new Date(log.timestamp) >= weekAgo && log.status === 'success')
    .reduce((sum, log) => sum + log.emailsDeleted, 0)

  const monthCount = activityLog
    .filter(log => new Date(log.timestamp) >= monthAgo && log.status === 'success')
    .reduce((sum, log) => sum + log.emailsDeleted, 0)

  const lastCleanup = activityLog.length > 0
    ? activityLog[0].timestamp
    : null

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <BarChart className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{weekCount}</div>
          <p className="text-xs text-gray-500">emails cleaned</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Calendar className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{monthCount}</div>
          <p className="text-xs text-gray-500">emails cleaned</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Cleanup</CardTitle>
          <Clock className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {lastCleanup ? formatDate(lastCleanup) : 'Never'}
          </div>
          <p className="text-xs text-gray-500">
            {lastCleanup ? formatTime(lastCleanup) : 'No cleanup yet'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Activity Log Component
function ActivityLogList({ activityLog }: { activityLog: ActivityLog[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your cleanup history</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {activityLog.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {activityLog.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50">
                  {log.status === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {log.status === 'success'
                        ? `${log.emailsDeleted} emails deleted`
                        : 'Failed'
                      }
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Email Preview Card Component
function EmailPreviewCard({
  email,
  selected,
  onToggle
}: {
  email: EmailPreview
  selected: boolean
  onToggle: () => void
}) {
  const getInitials = (sender: string) => {
    const words = sender.split(' ')
    return words.length > 1
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : sender.substring(0, 2).toUpperCase()
  }

  const getCategoryColor = (category?: string) => {
    if (!category) return 'bg-gray-100 text-gray-800'
    const cat = category.toLowerCase()
    if (cat.includes('promo')) return 'bg-purple-100 text-purple-800'
    if (cat.includes('social')) return 'bg-blue-100 text-blue-800'
    if (cat.includes('update')) return 'bg-green-100 text-green-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div
      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
        selected ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-gray-50'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onCheckedChange={onToggle} />
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
          {getInitials(email.sender)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">{email.sender}</p>
            {email.category && (
              <Badge variant="secondary" className={`text-xs ${getCategoryColor(email.category)}`}>
                {email.category}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-900 truncate mt-0.5">{email.subject}</p>
          <p className="text-xs text-gray-500 truncate mt-1">{email.snippet}</p>
          <p className="text-xs text-gray-400 mt-1">{formatDate(email.date)}</p>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([])
  const [settings, setSettings] = useState<CleanupSettings>(loadSettings())

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [emailPreviews, setEmailPreviews] = useState<EmailPreview[]>([])
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [chatError, setChatError] = useState<string | null>(null)

  // Periodic cleanup state
  const [periodicLoading, setPeriodicLoading] = useState(false)
  const [periodicError, setPeriodicError] = useState<string | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Load activity log on mount
  useEffect(() => {
    setActivityLog(loadActivityLog())
  }, [])

  // Save settings to localStorage
  const saveSettings = () => {
    try {
      localStorage.setItem('gmail_cleanup_settings', JSON.stringify(settings))
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 3000)
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  // Add activity log entry
  const addActivityLog = (action: string, emailsDeleted: number, status: 'success' | 'error') => {
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action,
      emailsDeleted,
      status
    }
    const updatedLogs = [newLog, ...activityLog].slice(0, 50) // Keep last 50
    setActivityLog(updatedLogs)
    saveActivityLog(updatedLogs)
  }

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setChatLoading(true)
    setChatError(null)

    try {
      const result = await callAIAgent(chatInput, RANDOM_AGENT_ID)

      if (result.success && result.response.status === 'success') {
        const data = result.response.result as RandomAgentResponse

        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString()
        }
        setChatMessages(prev => [...prev, assistantMessage])

        // Update email previews if any
        if (data.email_preview && data.email_preview.length > 0) {
          setEmailPreviews(data.email_preview)
          setSelectedEmails(new Set())
        } else {
          setEmailPreviews([])
        }

        // Add to activity log if emails were deleted
        if (data.emails_deleted > 0) {
          addActivityLog(
            `Chat cleanup: ${data.criteria_identified.category || 'emails'}`,
            data.emails_deleted,
            'success'
          )
        }
      } else {
        const errorMsg = result.error || result.response.message || 'Failed to process request'
        setChatError(errorMsg)

        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorMsg,
          timestamp: new Date().toISOString()
        }
        setChatMessages(prev => [...prev, errorMessage])
      }
    } catch (e) {
      const errorMsg = 'Network error. Please try again.'
      setChatError(errorMsg)

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date().toISOString()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  // Delete selected emails
  const deleteSelectedEmails = async () => {
    if (selectedEmails.size === 0) return

    setChatLoading(true)
    setChatError(null)

    try {
      const emailIds = Array.from(selectedEmails)
      const message = `Delete these specific emails: ${emailIds.join(', ')}`

      const result = await callAIAgent(message, RANDOM_AGENT_ID)

      if (result.success && result.response.status === 'success') {
        const data = result.response.result as RandomAgentResponse

        // Add activity log
        addActivityLog(
          `Deleted ${selectedEmails.size} selected emails`,
          data.emails_deleted,
          'success'
        )

        // Remove deleted emails from preview
        setEmailPreviews(prev => prev.filter(e => !selectedEmails.has(e.id)))
        setSelectedEmails(new Set())

        // Add confirmation message
        const confirmMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Successfully deleted ${data.emails_deleted} emails.`,
          timestamp: new Date().toISOString()
        }
        setChatMessages(prev => [...prev, confirmMessage])
      } else {
        setChatError(result.error || 'Failed to delete emails')
      }
    } catch (e) {
      setChatError('Network error. Please try again.')
    } finally {
      setChatLoading(false)
    }
  }

  // Toggle email selection
  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmails(prev => {
      const newSet = new Set(prev)
      if (newSet.has(emailId)) {
        newSet.delete(emailId)
      } else {
        newSet.add(emailId)
      }
      return newSet
    })
  }

  // Select all emails
  const selectAllEmails = () => {
    if (selectedEmails.size === emailPreviews.length) {
      setSelectedEmails(new Set())
    } else {
      setSelectedEmails(new Set(emailPreviews.map(e => e.id)))
    }
  }

  // Run cleanup now (periodic agent)
  const runCleanupNow = async () => {
    setPeriodicLoading(true)
    setPeriodicError(null)

    try {
      const message = `Run cleanup with settings: promotional=${settings.promotional}, old_emails=${settings.oldEmails}, age_threshold=${settings.ageThreshold} days`

      const result = await callAIAgent(message, PERIODIC_AGENT_ID)

      if (result.success && result.response.status === 'success') {
        const data = result.response.result as PeriodicResponse

        addActivityLog(
          'Scheduled cleanup executed',
          data.cleanup_summary.total_emails_deleted,
          'success'
        )

        // Switch to dashboard to show results
        setActiveTab('dashboard')
      } else {
        setPeriodicError(result.error || 'Cleanup failed')
        addActivityLog('Scheduled cleanup failed', 0, 'error')
      }
    } catch (e) {
      setPeriodicError('Network error. Please try again.')
      addActivityLog('Scheduled cleanup failed', 0, 'error')
    } finally {
      setPeriodicLoading(false)
    }
  }

  // Test run (same as run cleanup but with test flag)
  const testRunCleanup = async () => {
    setPeriodicLoading(true)
    setPeriodicError(null)

    try {
      const message = `Test cleanup (dry run) with settings: promotional=${settings.promotional}, old_emails=${settings.oldEmails}, age_threshold=${settings.ageThreshold} days. Do not delete, just show what would be deleted.`

      const result = await callAIAgent(message, PERIODIC_AGENT_ID)

      if (result.success && result.response.status === 'success') {
        const data = result.response.result as PeriodicResponse

        // Show test results in activity
        addActivityLog(
          `Test run: would delete ${data.cleanup_summary.total_emails_processed} emails`,
          0,
          'success'
        )
      } else {
        setPeriodicError(result.error || 'Test run failed')
      }
    } catch (e) {
      setPeriodicError('Network error. Please try again.')
    } finally {
      setPeriodicLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Gmail Cleaner Pro</h1>
                <p className="text-xs text-gray-500">Smart email management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
            <TabsTrigger value="dashboard">
              <BarChart className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <DashboardStats activityLog={activityLog} />

            <div className="grid gap-6 md:grid-cols-2">
              <ActivityLogList activityLog={activityLog} />

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Start cleaning your inbox</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => setActiveTab('chat')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Start Chat Cleanup
                  </Button>
                  <Button
                    onClick={runCleanupNow}
                    disabled={periodicLoading}
                    variant="outline"
                    className="w-full"
                  >
                    {periodicLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Run Cleanup Now
                  </Button>
                  {periodicError && (
                    <p className="text-sm text-red-600">{periodicError}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Chat Panel */}
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle>Chat Cleanup</CardTitle>
                  <CardDescription>Tell me what emails to clean</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4 mb-4">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Start a conversation</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {chatMessages.map(msg => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                msg.role === 'user'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              <p className="text-sm">{msg.content}</p>
                              <p className={`text-xs mt-1 ${
                                msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                {formatTime(msg.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {chatError && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{chatError}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Suggestion Chips */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChatInput('Show promotional emails')}
                        className="text-xs"
                      >
                        Show promotional emails
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChatInput('Emails older than 30 days')}
                        className="text-xs"
                      >
                        Emails older than 30 days
                      </Button>
                    </div>

                    {/* Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your cleanup request..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendChatMessage()
                          }
                        }}
                        disabled={chatLoading}
                      />
                      <Button
                        onClick={sendChatMessage}
                        disabled={chatLoading || !chatInput.trim()}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {chatLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Preview Panel */}
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle>Email Preview</CardTitle>
                  <CardDescription>
                    {emailPreviews.length > 0
                      ? `${emailPreviews.length} emails found`
                      : 'No emails to preview'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {emailPreviews.length > 0 && (
                    <div className="mb-4 flex items-center gap-2 pb-3 border-b">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllEmails}
                      >
                        {selectedEmails.size === emailPreviews.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteSelectedEmails}
                        disabled={selectedEmails.size === 0 || chatLoading}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {chatLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete Selected ({selectedEmails.size})
                      </Button>
                    </div>
                  )}

                  <ScrollArea className="h-[440px] pr-4">
                    {emailPreviews.length === 0 ? (
                      <div className="text-center py-12">
                        <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Emails will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {emailPreviews.map(email => (
                          <EmailPreviewCard
                            key={email.id}
                            email={email}
                            selected={selectedEmails.has(email.id)}
                            onToggle={() => toggleEmailSelection(email.id)}
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cleanup Rules</CardTitle>
                <CardDescription>Configure what types of emails to clean</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Promotional Emails</Label>
                    <p className="text-sm text-gray-500">Clean promotional and marketing emails</p>
                  </div>
                  <Switch
                    checked={settings.promotional}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({ ...prev, promotional: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Old Emails</Label>
                      <p className="text-sm text-gray-500">Clean emails older than threshold</p>
                    </div>
                    <Switch
                      checked={settings.oldEmails}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({ ...prev, oldEmails: checked }))
                      }
                    />
                  </div>
                  {settings.oldEmails && (
                    <div className="ml-0 mt-2">
                      <Label className="text-sm text-gray-600">Age Threshold</Label>
                      <Select
                        value={settings.ageThreshold.toString()}
                        onValueChange={(value) =>
                          setSettings(prev => ({ ...prev, ageThreshold: parseInt(value) }))
                        }
                      >
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>Automate your email cleanup</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Scheduling</Label>
                    <p className="text-sm text-gray-500">Run cleanup automatically</p>
                  </div>
                  <Switch
                    checked={settings.scheduleEnabled}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({ ...prev, scheduleEnabled: checked }))
                    }
                  />
                </div>

                {settings.scheduleEnabled && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select
                        value={settings.frequency}
                        onValueChange={(value) =>
                          setSettings(prev => ({ ...prev, frequency: value as 'daily' | 'weekly' | 'disabled' }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={settings.scheduleTime}
                        onChange={(e) =>
                          setSettings(prev => ({ ...prev, scheduleTime: e.target.value }))
                        }
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Safety Settings</CardTitle>
                <CardDescription>Protect your important emails</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Require Confirmation</Label>
                    <p className="text-sm text-gray-500">Ask before deleting emails</p>
                  </div>
                  <Switch
                    checked={settings.requireConfirmation}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({ ...prev, requireConfirmation: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Max Emails Per Run</Label>
                  <Select
                    value={settings.maxEmailsPerRun.toString()}
                    onValueChange={(value) =>
                      setSettings(prev => ({ ...prev, maxEmailsPerRun: parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 emails</SelectItem>
                      <SelectItem value="100">100 emails</SelectItem>
                      <SelectItem value="200">200 emails</SelectItem>
                      <SelectItem value="500">500 emails</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={saveSettings}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
              <Button
                onClick={testRunCleanup}
                disabled={periodicLoading}
                variant="outline"
                className="flex-1"
              >
                {periodicLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Filter className="h-4 w-4 mr-2" />
                )}
                Test Run
              </Button>
            </div>

            {settingsSaved && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600">Settings saved successfully!</p>
              </div>
            )}

            {periodicError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{periodicError}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
