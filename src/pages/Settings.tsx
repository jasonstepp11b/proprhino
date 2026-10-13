import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApiKeyStatus, useUpdateApiKey } from '@/lib/queries'

function ApiKeyCard() {
  const status = useApiKeyStatus()
  const update = useUpdateApiKey()
  const [apiKey, setApiKey] = useState('')

  function handleSave(event: FormEvent) {
    event.preventDefault()
    update.mutate(apiKey.trim(), { onSuccess: () => setApiKey('') })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Anthropic API key</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground">
          Used only to write AI reviews on the Performance page, and billed to your Anthropic account. The key is stored on the server and is never sent back to this
          browser; only its last four characters are shown here.
        </p>

        {status.isPending && <p className="text-muted-foreground">Checking…</p>}
        {status.error && <p className="text-destructive">{status.error.message}</p>}
        {status.data &&
          (status.data.configured ? (
            <p>
              A key ending in <span className="font-mono font-medium">{status.data.hint}</span> is saved
              {status.data.updatedAt && <span className="text-muted-foreground"> (since {new Date(status.data.updatedAt).toLocaleDateString('en-US')})</span>}.
            </p>
          ) : (
            <p>No key saved yet. Create one in the Anthropic Console under API keys.</p>
          ))}

        <form onSubmit={handleSave} className="grid gap-2">
          <Label htmlFor="anthropic_api_key">{status.data?.configured ? 'Replace key' : 'API key'}</Label>
          <div className="flex gap-2">
            <Input
              id="anthropic_api_key"
              type="password"
              autoComplete="off"
              placeholder="sk-ant-…"
              required
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Checking…' : 'Save'}
            </Button>
            {status.data?.configured && (
              <Button
                type="button"
                variant="outline"
                disabled={update.isPending}
                onClick={() => window.confirm('Remove the saved API key? AI reviews will stop working until you add one.') && update.mutate(null)}
              >
                Remove
              </Button>
            )}
          </div>
        </form>
        {update.error && <p className="text-destructive">{update.error.message}</p>}
        {update.isSuccess && update.data.configured && <p className="text-primary">Key verified with Anthropic and saved.</p>}
      </CardContent>
    </Card>
  )
}

export function Settings() {
  const { session } = useAuth()
  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Account</CardTitle>
        </CardHeader>
        <CardContent>
          Signed in as <span className="font-medium">{session?.user.email}</span>
        </CardContent>
      </Card>
      <ApiKeyCard />
    </div>
  )
}
