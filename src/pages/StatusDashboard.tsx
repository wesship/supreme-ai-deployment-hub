import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Activity,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Wifi,
  WifiOff,
  Loader2,
  RotateCcw,
  Server,
  Clock,
  Globe,
} from "lucide-react";
import { useServiceHealth, type ServiceEndpoint } from "@/hooks/useServiceHealth";
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

export default function StatusDashboard() {
  const {
    endpoints,
    statuses,
    isChecking,
    checkAll,
    addEndpoint,
    updateEndpoint,
    removeEndpoint,
    resetToDefaults,
  } = useServiceHealth();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newService, setNewService] = useState({ name: "", url: "", description: "", icon: "🔧" });
  const [editValues, setEditValues] = useState<Partial<ServiceEndpoint>>({});

  const onlineCount = Object.values(statuses).filter((s) => s.status === "online").length;
  const offlineCount = Object.values(statuses).filter((s) => s.status === "offline").length;
  const avgLatency = (() => {
    const latencies = Object.values(statuses).filter((s) => s.latency !== null).map((s) => s.latency!);
    return latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  })();

  const handleAdd = () => {
    if (newService.name && newService.url) {
      addEndpoint(newService);
      setNewService({ name: "", url: "", description: "", icon: "🔧" });
      setAddDialogOpen(false);
    }
  };

  const startEdit = (ep: ServiceEndpoint) => {
    setEditingId(ep.id);
    setEditValues({ name: ep.name, url: ep.url, description: ep.description });
  };

  const saveEdit = (id: string) => {
    updateEndpoint(id, editValues);
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <D3vonnPageBanner title="Service Status" />
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              Service Status
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor your Docker services and infrastructure endpoints
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetToDefaults}>
              <RotateCcw className="h-4 w-4 mr-1" /> Defaults
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Service
            </Button>
            <Button size="sm" onClick={checkAll} disabled={isChecking}>
              {isChecking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {isChecking ? "Checking…" : "Check All"}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Services</p>
                  <p className="text-2xl font-bold">{endpoints.length}</p>
                </div>
                <Server className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Online</p>
                  <p className="text-2xl font-bold text-green-500">{onlineCount}</p>
                </div>
                <Wifi className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Offline</p>
                  <p className="text-2xl font-bold text-destructive">{offlineCount}</p>
                </div>
                <WifiOff className="h-8 w-8 text-destructive/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Latency</p>
                  <p className="text-2xl font-bold">{avgLatency}ms</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service List */}
        <div className="space-y-3">
          <AnimatePresence>
            {endpoints.map((ep) => {
              const status = statuses[ep.id];
              const isEditing = editingId === ep.id;

              return (
                <motion.div
                  key={ep.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  layout
                >
                  <Card className={`transition-all ${
                    status?.status === "online" ? "border-green-500/30" :
                    status?.status === "offline" ? "border-destructive/30" : ""
                  }`}>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        {/* Status Indicator */}
                        <div className={`w-3 h-3 rounded-full shrink-0 ${
                          status?.status === "online" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                          status?.status === "offline" ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                          status?.status === "checking" ? "bg-yellow-500 animate-pulse" :
                          "bg-muted-foreground/30"
                        }`} />

                        {/* Icon */}
                        <span className="text-2xl">{ep.icon}</span>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex gap-2 items-center">
                              <Input
                                value={editValues.name ?? ""}
                                onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                className="h-8 w-40"
                                placeholder="Name"
                              />
                              <Input
                                value={editValues.url ?? ""}
                                onChange={(e) => setEditValues({ ...editValues, url: e.target.value })}
                                className="h-8 flex-1 font-mono text-xs"
                                placeholder="URL"
                              />
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(ep.id)}>
                                <Check className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm">{ep.name}</h3>
                                <Badge variant={
                                  status?.status === "online" ? "default" :
                                  status?.status === "offline" ? "destructive" :
                                  "secondary"
                                } className="text-[10px] px-1.5 py-0">
                                  {status?.status ?? "unknown"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{ep.url}</p>
                              {ep.description && (
                                <p className="text-xs text-muted-foreground/70 mt-0.5">{ep.description}</p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Latency */}
                        {status?.latency !== null && status?.latency !== undefined && !isEditing && (
                          <div className="text-right shrink-0">
                            <span className={`text-sm font-mono ${
                              status.latency < 100 ? "text-green-500" :
                              status.latency < 500 ? "text-yellow-500" :
                              "text-destructive"
                            }`}>
                              {status.latency}ms
                            </span>
                          </div>
                        )}

                        {/* Error */}
                        {status?.error && !isEditing && (
                          <span className="text-xs text-destructive shrink-0">{status.error}</span>
                        )}

                        {/* Actions */}
                        {!isEditing && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(ep)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeEndpoint(ep.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Last checked */}
                      {status?.lastChecked && !isEditing && (
                        <p className="text-[10px] text-muted-foreground/50 mt-2 ml-11">
                          Last checked: {status.lastChecked.toLocaleTimeString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {endpoints.length === 0 && (
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold mb-2">No services configured</h3>
              <p className="text-sm text-muted-foreground mb-4">Add your Docker service endpoints to monitor them.</p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Service
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Service Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service Endpoint</DialogTitle>
            <DialogDescription>Configure a new service to monitor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service Name</Label>
              <Input placeholder="My Service" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Health Check URL</Label>
              <Input placeholder="http://localhost:3000/health" value={newService.url} onChange={(e) => setNewService({ ...newService, url: e.target.value })} className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input placeholder="What this service does" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newService.name || !newService.url}>Add Service</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
