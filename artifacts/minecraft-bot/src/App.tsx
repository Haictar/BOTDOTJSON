import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AlertTriangle, ArrowUpRight, Bot, Check, CircleHelp, Clock3, LoaderCircle, Play, RefreshCw, Save, Server, Square, Wifi, WifiOff } from 'lucide-react';
import {
  getGetBotSettingsQueryKey,
  getGetBotStatusQueryKey,
  getHealthCheckQueryKey,
  useGetBotSettings,
  useGetBotStatus,
  useHealthCheck,
  useRestartBot,
  useStartBot,
  useStopBot,
  useUpdateBotSettings,
  type BotServerSettingsInput,
} from '@workspace/api-client-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
});

function formatStatus(status: string) {
  if (!status) return 'Unknown';
  return status.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const serverSettingsSchema = z.object({
  serverHost: z
    .string()
    .trim()
    .min(1, 'Enter a server address.')
    .max(253, 'Server address is too long.')
    .regex(/^[A-Za-z0-9.-]+$/, 'Use a hostname or IPv4 address without a protocol.'),
  serverPort: z.number().int().min(1, 'Port must be between 1 and 65535.').max(65535, 'Port must be between 1 and 65535.'),
  minecraftVersion: z
    .string()
    .trim()
    .regex(/^(auto|\d+(?:\.\d+){1,2})$/, 'Enter "auto" or a Java version such as 1.21.4.'),
});

function Dashboard() {
  const queryClient = useQueryClient();
  const botQuery = useGetBotStatus({
    query: { queryKey: getGetBotStatusQueryKey(), refetchInterval: 5000 },
  });
  const settingsQuery = useGetBotSettings({
    query: { queryKey: getGetBotSettingsQueryKey(), refetchInterval: 30000 },
  });
  const healthQuery = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 },
  });
  const settingsForm = useForm<BotServerSettingsInput>({
    resolver: zodResolver(serverSettingsSchema),
    defaultValues: { serverHost: '', serverPort: 25565, minecraftVersion: 'auto' },
  });
  const { reset: resetSettings, formState: { isDirty: settingsAreDirty } } = settingsForm;

  useEffect(() => {
    if (settingsQuery.data && !settingsAreDirty) {
      resetSettings(settingsQuery.data);
    }
  }, [settingsQuery.data, settingsAreDirty, resetSettings]);

  const onActionSuccess = (response: { message: string; status: NonNullable<typeof botQuery.data> }) => {
    queryClient.setQueryData(getGetBotStatusQueryKey(), response.status);
    void queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
  };
  const startBot = useStartBot({ mutation: { onSuccess: onActionSuccess } });
  const stopBot = useStopBot({ mutation: { onSuccess: onActionSuccess } });
  const restartBot = useRestartBot({ mutation: { onSuccess: onActionSuccess } });
  const saveSettings = useUpdateBotSettings({
    mutation: {
      onSuccess: (response) => {
        resetSettings(response.settings);
        queryClient.setQueryData(getGetBotSettingsQueryKey(), response.settings);
        void queryClient.invalidateQueries({ queryKey: getGetBotSettingsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
      },
    },
  });
  const isPending = startBot.isPending || stopBot.isPending || restartBot.isPending;
  const bot = botQuery.data;
  const canControl = bot?.controlAvailable !== false;
  const connected = Boolean(bot?.connected);
  const apiAvailable = healthQuery.isSuccess;
  const actionError = startBot.error || stopBot.error || restartBot.error;
  const actionMessage = startBot.data?.message || stopBot.data?.message || restartBot.data?.message;
  const updatedAt = botQuery.dataUpdatedAt ? new Date(botQuery.dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

  const handleAction = (action: 'start' | 'stop' | 'restart') => {
    if (action === 'start') startBot.mutate();
    if (action === 'stop') stopBot.mutate();
    if (action === 'restart') restartBot.mutate();
  };

  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1320px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex h-[76px] items-center justify-between border-b border-border/80">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-[11px] bg-primary text-primary-foreground">
              <Bot size={19} strokeWidth={1.8} />
            </div>
            <div>
               <div className="display text-[15px] font-semibold tracking-[-.035em]">TRIO</div>
              <div className="mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">Bot operations</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-full border border-border/80 bg-card px-3 py-2">
            <span className={`relative flex size-[7px] items-center justify-center rounded-full ${apiAvailable ? 'bg-[#58856d]' : healthQuery.isLoading ? 'bg-[#c58a3a]' : 'bg-[#b15445]'}`}>
              {apiAvailable && <span className="pulse-dot absolute size-[7px] rounded-full bg-[#58856d]" />}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {healthQuery.isLoading ? 'Checking API' : apiAvailable ? 'API available' : 'API unavailable'}
            </span>
          </div>
        </header>

        <div className="page-enter flex-1 pb-12 pt-9 sm:pt-12">
          <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end">
            <div>
              <div className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-muted-foreground">Control room <span className="mx-1.5 text-border">/</span> Overview</div>
              <h1 className="display text-[34px] font-semibold leading-[1.08] tracking-[-.055em] sm:text-[42px]">Connection monitor</h1>
              <p className="mt-2 text-[14px] text-muted-foreground">A clear view of your Minecraft operator, wherever it is.</p>
            </div>
            <button
              type="button"
              data-testid="button-refresh-status"
              onClick={() => {
                void botQuery.refetch();
                void healthQuery.refetch();
              }}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw size={14} className={botQuery.isFetching ? 'animate-spin' : ''} />
              Refresh status
            </button>
          </div>

          {healthQuery.isError && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e5c7b6] bg-[#f7e9df] px-4 py-3.5 text-[#804b39]" role="status" data-testid="status-api-error">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">The API is not responding</p>
                <p className="mt-0.5 text-[12px] opacity-80">Health checks are failing. Try again in a moment.</p>
              </div>
              <button type="button" className="text-[12px] font-semibold underline underline-offset-2" onClick={() => void healthQuery.refetch()} data-testid="button-retry-health">Retry</button>
            </div>
          )}

          {botQuery.isError && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e5c7b6] bg-[#f7e9df] px-4 py-3.5 text-[#804b39]" role="alert" data-testid="status-bot-error">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">Could not load bot status</p>
                <p className="mt-0.5 text-[12px] opacity-80">The connection details are temporarily unavailable.</p>
              </div>
              <button type="button" className="text-[12px] font-semibold underline underline-offset-2" onClick={() => void botQuery.refetch()} data-testid="button-retry-status">Retry</button>
            </div>
          )}

          {bot && (
            <>
              <section className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[1.35fr_.65fr]" aria-label="Bot connection status">
                <div className="relative overflow-hidden p-6 sm:p-8">
                  <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
                  <div className="relative">
                    <div className="mb-8 flex items-center justify-between gap-4">
                      <span className="mono text-[10px] uppercase tracking-[.17em] text-muted-foreground">Live connection</span>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ${connected ? 'bg-[#e3eee4] text-[#376347]' : 'bg-[#f3e8df] text-[#9b5b3e]'}`} data-testid="status-connection">
                        <span className={`size-1.5 rounded-full ${connected ? 'bg-[#548361]' : 'bg-[#be7654]'}`} />
                        {connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <div className="mb-2 text-[12px] text-muted-foreground">Account</div>
                        <h2 className="display text-[31px] font-semibold leading-none tracking-[-.045em] sm:text-[38px]" data-testid="text-username">{bot.username || 'Unnamed bot'}</h2>
                      </div>
                      <div className="pb-0.5 text-right">
                        <div className="mb-2 text-[12px] text-muted-foreground">Current state</div>
                        <div className="mono text-[13px] font-medium" data-testid="text-bot-state">{formatStatus(bot.status)}</div>
                      </div>
                    </div>
                    <div className="mt-8 flex items-center gap-2 border-t border-border/80 pt-4 text-[11px] text-muted-foreground">
                      <Clock3 size={13} />
                      <span>{updatedAt ? `Updated at ${updatedAt}` : 'Waiting for first status update'}</span>
                      <span className="ml-auto mono text-[10px]">AUTO-REFRESH · 5 SEC</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border bg-[#f4f3ec] p-6 sm:p-8 lg:border-l lg:border-t-0">
                  <div className="mono mb-5 text-[10px] uppercase tracking-[.17em] text-muted-foreground">Desired state</div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className={`grid size-10 place-items-center rounded-xl ${bot.desiredState === 'running' ? 'bg-[#e1eadf] text-[#4b7353]' : 'bg-[#e9e4d8] text-[#756e5a]'}`}>
                      {bot.desiredState === 'running' ? <Play size={17} fill="currentColor" /> : <Square size={15} fill="currentColor" />}
                    </span>
                    <div>
                      <div className="display text-[21px] font-semibold capitalize tracking-[-.035em]" data-testid="text-desired-state">{bot.desiredState}</div>
                      <div className="text-[11px] text-muted-foreground">{bot.desiredState === 'running' ? 'Automatic retries enabled' : 'Automatic retries disabled'}</div>
                    </div>
                  </div>
                  <p className="mt-5 text-[12px] leading-[1.6] text-muted-foreground">
                    {connected ? 'The account is currently active on the server.' : bot.desiredState === 'running' ? 'The service retries failed connections with increasing delays. Autoscale may pause while idle; use a Reserved VM for continuous retries.' : 'The bot will remain offline until started.'}
                  </p>
                </div>
              </section>

              <section className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <div className="mono text-[10px] uppercase tracking-[.17em] text-muted-foreground">Operator controls</div>
                      <h2 className="display mt-1.5 text-[19px] font-semibold tracking-[-.035em]">Intervene when needed</h2>
                    </div>
                     <div className="grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground"><CircleHelp size={17} /></div>
                  </div>

                  {!bot.controlAvailable && (
                    <div className="mb-5 flex gap-3 rounded-xl border border-[#dfd7bd] bg-[#f4f0df] p-3.5 text-[#766b48]" data-testid="notice-controls-unavailable">
                      <CircleHelp size={17} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[12px] font-semibold">Controls unavailable in this environment</p>
                       <p className="mt-1 text-[11px] leading-relaxed text-[#857a58]">Minecraft access is restricted to the published deployment. You can still save server settings here.</p>
                      </div>
                    </div>
                  )}
                  {actionError && (
                    <div className="mb-4 rounded-lg border border-[#e5c7b6] bg-[#f7e9df] px-3 py-2.5 text-[12px] text-[#804b39]" role="alert" data-testid="status-action-error">
                      {actionError instanceof Error ? actionError.message : 'The requested action could not be completed.'}
                    </div>
                  )}
                  {actionMessage && !actionError && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#c9dcc9] bg-[#e8f0e6] px-3 py-2.5 text-[12px] text-[#376347]" role="status" data-testid="status-action-success">
                      <Check size={14} /> {actionMessage}
                    </div>
                  )}

                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <button type="button" data-testid="button-start-bot" onClick={() => handleAction('start')} disabled={!canControl || isPending} className="control-button primary-control">
                      {isPending && startBot.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}
                      Start bot
                    </button>
                    <button type="button" data-testid="button-restart-bot" onClick={() => handleAction('restart')} disabled={!canControl || isPending} className="control-button">
                      {isPending && restartBot.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                      Restart
                    </button>
                    <button type="button" data-testid="button-stop-bot" onClick={() => handleAction('stop')} disabled={!canControl || isPending} className="control-button stop-control">
                      {isPending && stopBot.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Square size={14} fill="currentColor" />}
                      Stop bot
                    </button>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
                     <CircleHelp size={13} />
                     <span>No sign-in or password is required for these controls.</span>
                  </div>
                </div>

                 <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
                   <div className="mb-5 flex items-start gap-3">
                     <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><Server size={16} /></div>
                     <div>
                       <div className="mono text-[10px] uppercase tracking-[.17em] text-muted-foreground">Server settings</div>
                       <h2 className="display mt-1.5 text-[19px] font-semibold tracking-[-.035em]">Connect to this server</h2>
                     </div>
                   </div>
                   <Form {...settingsForm}>
                     <form
                       onSubmit={settingsForm.handleSubmit((values) => saveSettings.mutate({ data: values }))}
                       className="space-y-4"
                       data-testid="form-server-settings"
                     >
                       <div className="grid gap-4 sm:grid-cols-[1fr_132px]">
                         <FormField
                           control={settingsForm.control}
                           name="serverHost"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel className="text-[11px] text-muted-foreground">Server address</FormLabel>
                               <FormControl>
                                 <Input {...field} data-testid="input-server-host" autoComplete="url" placeholder="play.example.net" className="h-10 bg-[#fbfaf6] text-[12px] mono" />
                               </FormControl>
                               <FormMessage className="text-[11px]" />
                             </FormItem>
                           )}
                         />
                         <FormField
                           control={settingsForm.control}
                           name="serverPort"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel className="text-[11px] text-muted-foreground">Port</FormLabel>
                               <FormControl>
                                 <Input
                                   type="number"
                                   min={1}
                                   max={65535}
                                   step={1}
                                   inputMode="numeric"
                                   value={field.value ?? ''}
                                   onChange={(event) => field.onChange(event.currentTarget.value === '' ? undefined : event.currentTarget.valueAsNumber)}
                                   onBlur={field.onBlur}
                                   name={field.name}
                                   ref={field.ref}
                                   data-testid="input-server-port"
                                   className="h-10 bg-[#fbfaf6] text-[12px] mono"
                                 />
                               </FormControl>
                               <FormMessage className="text-[11px]" />
                             </FormItem>
                           )}
                         />
                       </div>
                        <FormField
                          control={settingsForm.control}
                          name="minecraftVersion"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[11px] text-muted-foreground">Minecraft Java version</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  data-testid="input-minecraft-version"
                                  autoComplete="off"
                                  placeholder="auto or 1.21.4"
                                  className="h-10 bg-[#fbfaf6] text-[12px] mono"
                                />
                              </FormControl>
                              <FormMessage className="text-[11px]" />
                              <p className="text-[10px] leading-relaxed text-muted-foreground">
                                Use “auto” to detect it from the server ping, or enter the exact Java version to bypass detection. Mineflayer supports Java 1.8.8–26.1; Bedrock servers are not supported.
                              </p>
                            </FormItem>
                          )}
                        />
                       <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Saved changes reconnect TRIO if it is running.
                       </p>
                       {settingsQuery.isError && (
                         <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e5c7b6] bg-[#f7e9df] px-3 py-2.5 text-[11px] text-[#804b39]" role="alert" data-testid="status-settings-load-error">
                           <span>Could not load the saved server settings.</span>
                           <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void settingsQuery.refetch()}>Retry</button>
                         </div>
                       )}
                       {saveSettings.error && (
                         <p className="rounded-lg border border-[#e5c7b6] bg-[#f7e9df] px-3 py-2.5 text-[11px] text-[#804b39]" role="alert" data-testid="status-settings-save-error">
                           {saveSettings.error instanceof Error ? saveSettings.error.message : 'Could not save server settings.'}
                         </p>
                       )}
                       {saveSettings.data && !saveSettings.error && (
                         <p className="rounded-lg border border-[#c9dcc9] bg-[#e8f0e6] px-3 py-2.5 text-[11px] text-[#376347]" role="status" data-testid="status-settings-save-success">
                           {saveSettings.data.message}
                         </p>
                       )}
                       <button
                         type="submit"
                         disabled={!settingsQuery.isSuccess || saveSettings.isPending}
                         className="control-button primary-control w-full"
                         data-testid="button-save-server-settings"
                       >
                         {saveSettings.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
                         Save server settings
                       </button>
                     </form>
                   </Form>
                   <div className="mt-5 border-t border-border/70 pt-1">
                     <DetailRow icon={connected ? <Wifi size={15} /> : <WifiOff size={15} />} label="Position" value={bot.position || 'Position unavailable'} mono testId="text-position" last />
                   </div>
                 </div>
              </section>

              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border/80 bg-[#eeede5] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-7 place-items-center rounded-lg bg-card text-primary"><Check size={14} /></span>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">Opening this page can wake the API on Autoscale, which starts TRIO on service startup. Autoscale may pause while idle; use a Reserved VM to keep it connected continuously. Anyone who can reach this page can control TRIO and change its server address, port, and Java version; no password is required.</p>
                </div>
                <a href="https://www.minecraft.net/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary transition-colors hover:text-foreground">
                  Minecraft server <ArrowUpRight size={13} />
                </a>
              </div>
            </>
          )}

          {botQuery.isLoading && (
            <div className="space-y-5" aria-label="Loading bot status" data-testid="loading-bot-status">
              <div className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[1.35fr_.65fr]">
                <div className="animate-pulse p-8">
                  <div className="mb-8 h-3 w-28 rounded bg-secondary" />
                  <div className="h-9 w-48 rounded bg-secondary" />
                  <div className="mt-8 h-3 w-36 rounded bg-secondary" />
                </div>
                <div className="border-t border-border bg-secondary/50 p-8 lg:border-l lg:border-t-0">
                  <div className="h-3 w-24 animate-pulse rounded bg-border" />
                  <div className="mt-5 h-10 w-36 animate-pulse rounded bg-border" />
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
                <div className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
              </div>
            </div>
          )}

          {!bot && botQuery.isError && (
            <div className="grid min-h-[340px] place-items-center rounded-2xl border border-dashed border-border bg-card/55 p-8 text-center" data-testid="empty-bot-status">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Bot size={22} /></div>
                <h2 className="display mt-4 text-lg font-semibold">No connection data yet</h2>
                <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">The monitor will show account and server details as soon as the bot service responds.</p>
                <button type="button" className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90" onClick={() => void botQuery.refetch()} data-testid="button-retry-empty">
                  <RefreshCw size={13} /> Try again
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="flex h-14 items-center justify-between border-t border-border/80 text-[10px] text-muted-foreground">
          <span className="mono uppercase tracking-[.13em]">TRIO <span className="mx-1.5">·</span> Operator console</span>
          <span className="mono">RESERVED VM FOR 24 / 7</span>
        </footer>
      </div>
    </main>
  );
}

function DetailRow({ icon, label, value, mono = false, testId, last = false }: { icon: ReactNode; label: string; value: string; mono?: boolean; testId: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3.5 ${last ? '' : 'border-b border-border/70'}`}>
      <div className="flex items-center gap-2.5 text-muted-foreground">
        {icon}
        <span className="text-[12px]">{label}</span>
      </div>
      <span data-testid={testId} className={`max-w-[62%] truncate text-right text-[12px] font-medium text-foreground ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
