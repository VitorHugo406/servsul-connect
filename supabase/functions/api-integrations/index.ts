import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * API Integrations - External Analytics API
 * 
 * Public Endpoints (authenticated via X-API-KEY + X-API-TOKEN):
 *   GET /metrics/general - System-wide metrics
 *   GET /metrics/users - All users metrics
 *   GET /metrics/users/:id - Single user metrics
 *   GET /metrics/departments - Department metrics
 *   GET /metrics/departments/:id - Single department
 *   GET /metrics/teams - Team metrics
 *   GET /metrics/teams/:id - Single team
 *   GET /tasks/summary - Tasks summary
 *   GET /messages/summary - Messages summary
 *   GET /users/data - All users full data (profiles, roles, teams, departments)
 *   GET /users/data/:id - Single user full data
 *   GET /users/sectors - All sectors with user counts
 *   GET /users/teams - All teams with members
 * 
 * Admin Endpoints (authenticated via Bearer token):
 *   POST /admin/integrations - Create integration
 *   GET /admin/integrations - List integrations
 *   PATCH /admin/integrations/:id/activate - Activate
 *   PATCH /admin/integrations/:id/deactivate - Deactivate
 *   PATCH /admin/integrations/:id/regenerate - Regenerate credentials
 *   DELETE /admin/integrations/:id - Delete integration
 * 
 * Query params for metrics: start_date, end_date, status
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-api-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateKey(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = prefix + "_";
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function validateAdminAuth(req: Request): Promise<{ userId: string; companyId: string; isSuperAdmin: boolean } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const adminClient = getAdminClient();
  
  // Validate JWT using admin client
  const { data: userData, error } = await adminClient.auth.getUser(token);
  if (error || !userData?.user) return null;

  const userId = userData.user.id;
  
  // Check admin role only (restricted to admins)
  const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleData || []).map((r: any) => r.role);
  
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    return null;
  }

  const { data: profile } = await adminClient.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
  if (!profile?.company_id) return null;

  return { userId, companyId: profile.company_id, isSuperAdmin: roles.includes("super_admin") };
}

async function validateApiAuth(req: Request): Promise<{ integrationId: string; companyId: string } | null> {
  const apiKey = req.headers.get("X-API-KEY");
  const apiToken = req.headers.get("X-API-TOKEN");
  if (!apiKey || !apiToken) return null;

  const admin = getAdminClient();
  const apiKeyHash = await hashToken(apiKey);
  const { data: integration } = await admin
    .from("api_integrations")
    .select("id, is_active, api_token_hash, company_id")
    .eq("api_key_hash", apiKeyHash)
    .maybeSingle();

  if (!integration) return null;
  if (!integration.is_active) return null;

  const tokenHash = await hashToken(apiToken);
  if (tokenHash !== integration.api_token_hash) return null;

  await admin.from("api_integrations").update({ last_used_at: new Date().toISOString() }).eq("id", integration.id);

  return { integrationId: integration.id, companyId: integration.company_id };
}

async function logAccess(integrationId: string, endpoint: string, method: string, statusCode: number, ip: string | null) {
  const admin = getAdminClient();
  await admin.from("api_access_logs").insert({
    integration_id: integrationId,
    endpoint,
    method,
    status_code: statusCode,
    ip_address: ip,
  });
}

// ===== ADMIN ENDPOINTS =====
async function handleAdminCreateIntegration(req: Request, userId: string) {
  const body = await req.json();
  const name = body.name?.trim();
  if (!name) return jsonResponse({ status: "error", message: "Nome é obrigatório." }, 400);

  const apiKey = generateKey("sk");
  const apiToken = generateKey("st");
  const apiKeyHash = await hashToken(apiKey);
  const tokenHash = await hashToken(apiToken);

  const admin = getAdminClient();
  const { data, error } = await admin.from("api_integrations").insert({
    name,
    api_key_hint: `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`,
    api_key_hash: apiKeyHash,
    api_token_hash: tokenHash,
    created_by: userId,
  }).select().single();

  if (error) {
    console.error("api_integrations insert error:", error);
    return jsonResponse({ status: "error", message: "Falha ao criar integração." }, 500);
  }

  await admin.from("api_integration_history").insert({
    integration_id: data.id,
    action: "created",
    performed_by: userId,
    details: `Integração "${name}" criada`,
  });

  const baseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/api-integrations`;

  return jsonResponse({
    status: "success",
    message: "Integração criada com sucesso.",
    data: {
      id: data.id,
      name: data.name,
      base_url: baseUrl,
      api_key: apiKey,
      api_token: apiToken,
      is_active: data.is_active,
      created_at: data.created_at,
    },
  });
}

async function handleAdminListIntegrations() {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("api_integrations")
    .select("id, name, is_active, created_by, created_at, updated_at, last_used_at")
    .order("created_at", { ascending: false });

  if (error) return jsonResponse({ status: "error", message: error.message }, 500);

  // Get creator names
  const creatorIds = [...new Set((data || []).map((d: any) => d.created_by))];
  const { data: profiles } = await admin.from("profiles").select("user_id, name, display_name").in("user_id", creatorIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name || p.name]));

  const integrations = (data || []).map((d: any) => ({
    ...d,
    created_by_name: profileMap.get(d.created_by) || "Desconhecido",
  }));

  return jsonResponse({ status: "success", data: integrations });
}

async function handleAdminToggle(integrationId: string, activate: boolean, userId: string) {
  const admin = getAdminClient();
  const { error } = await admin.from("api_integrations").update({ is_active: activate, updated_at: new Date().toISOString() }).eq("id", integrationId);
  if (error) return jsonResponse({ status: "error", message: error.message }, 500);

  await admin.from("api_integration_history").insert({
    integration_id: integrationId,
    action: activate ? "activated" : "deactivated",
    performed_by: userId,
  });

  return jsonResponse({ status: "success", message: activate ? "Integração ativada." : "Integração desativada." });
}

async function handleAdminRegenerate(integrationId: string, userId: string) {
  const apiKey = generateKey("sk");
  const apiToken = generateKey("st");
  const apiKeyHash = await hashToken(apiKey);
  const tokenHash = await hashToken(apiToken);

  const admin = getAdminClient();
  const { error } = await admin.from("api_integrations").update({
    api_key_hint: `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`,
    api_key_hash: apiKeyHash,
    api_token_hash: tokenHash,
    updated_at: new Date().toISOString(),
  }).eq("id", integrationId);

  if (error) {
    console.error("api_integrations regenerate error:", error);
    return jsonResponse({ status: "error", message: "Falha ao regenerar credenciais." }, 500);
  }

  await admin.from("api_integration_history").insert({
    integration_id: integrationId,
    action: "regenerated",
    performed_by: userId,
    details: "Credenciais regeneradas",
  });

  const baseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/api-integrations`;

  return jsonResponse({
    status: "success",
    message: "Credenciais regeneradas.",
    data: { api_key: apiKey, api_token: apiToken, base_url: baseUrl },
  });
}

async function handleAdminDelete(integrationId: string, userId: string) {
  const admin = getAdminClient();
  
  // Get name before delete
  const { data: integ } = await admin.from("api_integrations").select("name").eq("id", integrationId).maybeSingle();

  const { error } = await admin.from("api_integrations").delete().eq("id", integrationId);
  if (error) return jsonResponse({ status: "error", message: error.message }, 500);

  // Log to audit_logs since history is cascade deleted
  await admin.from("audit_logs").insert({
    table_name: "api_integrations",
    action: "DELETE",
    record_id: integrationId,
    description: `Integração API excluída: ${integ?.name || integrationId}`,
    performed_by: userId,
  });

  return jsonResponse({ status: "success", message: "Integração excluída." });
}

async function handleAdminHistory(integrationId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("api_integration_history")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return jsonResponse({ status: "error", message: error.message }, 500);

  // Get performer names
  const performerIds = [...new Set((data || []).map((d: any) => d.performed_by))];
  const { data: profiles } = await admin.from("profiles").select("user_id, name, display_name").in("user_id", performerIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name || p.name]));

  const history = (data || []).map((d: any) => ({
    ...d,
    performed_by_name: profileMap.get(d.performed_by) || "Desconhecido",
  }));

  return jsonResponse({ status: "success", data: history });
}

// ===== METRICS ENDPOINTS =====
function parseDateFilters(url: URL) {
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");
  return { startDate, endDate };
}

async function handleMetricsGeneral(url: URL) {
  const admin = getAdminClient();
  const { startDate, endDate } = parseDateFilters(url);

  // Total users
  const { count: totalUsers } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true);
  // Total sectors
  const { count: totalSectors } = await admin.from("sectors").select("id", { count: "exact", head: true });
  // Total teams (unique supervisors with team_name)
  const { data: teamsData } = await admin.from("supervisor_team_members").select("supervisor_id, team_name");
  const uniqueTeams = new Set((teamsData || []).map((t: any) => t.supervisor_id));

  // Messages
  let msgQuery = admin.from("messages").select("id", { count: "exact", head: true });
  if (startDate) msgQuery = msgQuery.gte("created_at", startDate);
  if (endDate) msgQuery = msgQuery.lte("created_at", endDate);
  const { count: totalMessages } = await msgQuery;

  // Tasks
  let taskQuery = admin.from("tasks").select("id", { count: "exact", head: true }).eq("is_template", false);
  if (startDate) taskQuery = taskQuery.gte("created_at", startDate);
  if (endDate) taskQuery = taskQuery.lte("created_at", endDate);
  const { count: totalTasks } = await taskQuery;

  let completedQuery = admin.from("tasks").select("id", { count: "exact", head: true }).eq("is_template", false).not("completed_at", "is", null);
  if (startDate) completedQuery = completedQuery.gte("created_at", startDate);
  if (endDate) completedQuery = completedQuery.lte("created_at", endDate);
  const { count: completedTasks } = await completedQuery;

  let lateQuery = admin.from("tasks").select("id", { count: "exact", head: true }).eq("is_template", false).eq("completed_late", true);
  if (startDate) lateQuery = lateQuery.gte("created_at", startDate);
  if (endDate) lateQuery = lateQuery.lte("created_at", endDate);
  const { count: lateTasks } = await lateQuery;

  const pendingTasks = (totalTasks || 0) - (completedTasks || 0);

  return jsonResponse({
    status: "success",
    message: "Consulta realizada com sucesso.",
    data: {
      total_users: totalUsers || 0,
      total_sectors: totalSectors || 0,
      total_teams: uniqueTeams.size,
      total_messages: totalMessages || 0,
      total_tasks: totalTasks || 0,
      completed_tasks: completedTasks || 0,
      pending_tasks: pendingTasks,
      late_tasks: lateTasks || 0,
      filters: { start_date: startDate, end_date: endDate },
    },
  });
}

async function handleMetricsUsers(url: URL, userId?: string) {
  const admin = getAdminClient();
  const { startDate, endDate } = parseDateFilters(url);

  let profileQuery = admin.from("profiles").select("id, user_id, name, display_name, email, sector_id, autonomy_level, last_seen_at, user_status, is_active").eq("is_active", true);
  if (userId) profileQuery = profileQuery.eq("id", userId);
  const { data: profiles } = await profileQuery;

  if (!profiles || profiles.length === 0) {
    return jsonResponse({ status: "success", data: userId ? null : [] });
  }

  const results = [];
  for (const p of profiles) {
    // Messages sent
    let sentQuery = admin.from("messages").select("id", { count: "exact", head: true }).eq("author_id", p.id);
    if (startDate) sentQuery = sentQuery.gte("created_at", startDate);
    if (endDate) sentQuery = sentQuery.lte("created_at", endDate);
    const { count: messagesSent } = await sentQuery;

    // DMs sent
    let dmSentQuery = admin.from("direct_messages").select("id", { count: "exact", head: true }).eq("sender_id", p.id);
    if (startDate) dmSentQuery = dmSentQuery.gte("created_at", startDate);
    if (endDate) dmSentQuery = dmSentQuery.lte("created_at", endDate);
    const { count: dmsSent } = await dmSentQuery;

    // DMs received
    let dmRecvQuery = admin.from("direct_messages").select("id", { count: "exact", head: true }).eq("receiver_id", p.id);
    if (startDate) dmRecvQuery = dmRecvQuery.gte("created_at", startDate);
    if (endDate) dmRecvQuery = dmRecvQuery.lte("created_at", endDate);
    const { count: dmsReceived } = await dmRecvQuery;

    // Tasks assigned
    const { data: taskAssignees } = await admin.from("task_assignees").select("task_id").eq("profile_id", p.id);
    const assignedTaskIds = (taskAssignees || []).map((t: any) => t.task_id);
    
    let assignedCount = 0, completedCount = 0, pendingCount = 0, lateCount = 0;
    if (assignedTaskIds.length > 0) {
      let tq = admin.from("tasks").select("id, completed_at, completed_late").in("id", assignedTaskIds).eq("is_template", false);
      if (startDate) tq = tq.gte("created_at", startDate);
      if (endDate) tq = tq.lte("created_at", endDate);
      const { data: tasks } = await tq;
      assignedCount = (tasks || []).length;
      completedCount = (tasks || []).filter((t: any) => t.completed_at).length;
      pendingCount = assignedCount - completedCount;
      lateCount = (tasks || []).filter((t: any) => t.completed_late).length;
    }

    // Sector name
    let sectorName = null;
    if (p.sector_id) {
      const { data: sector } = await admin.from("sectors").select("name").eq("id", p.sector_id).maybeSingle();
      sectorName = sector?.name;
    }

    // Team
    const { data: teamData } = await admin.from("supervisor_team_members").select("supervisor_id, team_name").eq("member_profile_id", p.id);

    results.push({
      id: p.id,
      name: p.display_name || p.name,
      email: p.email,
      department: sectorName,
      department_id: p.sector_id,
      team: teamData?.[0]?.team_name || null,
      autonomy_level: p.autonomy_level,
      messages_sent: (messagesSent || 0) + (dmsSent || 0),
      messages_received: dmsReceived || 0,
      tasks_assigned: assignedCount,
      tasks_completed: completedCount,
      tasks_pending: pendingCount,
      tasks_late: lateCount,
      productivity: assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0,
      last_access: p.last_seen_at,
      status: p.user_status,
    });
  }

  return jsonResponse({
    status: "success",
    message: "Consulta realizada com sucesso.",
    data: userId ? results[0] || null : results,
  });
}

async function handleMetricsDepartments(url: URL, deptId?: string) {
  const admin = getAdminClient();
  const { startDate, endDate } = parseDateFilters(url);

  let sectorQuery = admin.from("sectors").select("*");
  if (deptId) sectorQuery = sectorQuery.eq("id", deptId);
  const { data: sectors } = await sectorQuery;

  if (!sectors || sectors.length === 0) {
    return jsonResponse({ status: "success", data: deptId ? null : [] });
  }

  const results = [];
  for (const s of sectors) {
    const { count: userCount } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("sector_id", s.id).eq("is_active", true);

    let msgQ = admin.from("messages").select("id", { count: "exact", head: true }).eq("sector_id", s.id);
    if (startDate) msgQ = msgQ.gte("created_at", startDate);
    if (endDate) msgQ = msgQ.lte("created_at", endDate);
    const { count: messages } = await msgQ;

    // Tasks in this sector
    let taskQ = admin.from("tasks").select("id, completed_at, completed_late", { count: "exact" }).eq("sector_id", s.id).eq("is_template", false);
    if (startDate) taskQ = taskQ.gte("created_at", startDate);
    if (endDate) taskQ = taskQ.lte("created_at", endDate);
    const { data: tasks, count: totalTasks } = await taskQ;
    const completed = (tasks || []).filter((t: any) => t.completed_at).length;
    const late = (tasks || []).filter((t: any) => t.completed_late).length;

    results.push({
      id: s.id,
      name: s.name,
      color: s.color,
      total_users: userCount || 0,
      total_messages: messages || 0,
      total_tasks: totalTasks || 0,
      completed_tasks: completed,
      pending_tasks: (totalTasks || 0) - completed,
      late_tasks: late,
      performance: (totalTasks || 0) > 0 ? Math.round((completed / (totalTasks || 1)) * 100) : 0,
    });
  }

  return jsonResponse({
    status: "success",
    message: "Consulta realizada com sucesso.",
    data: deptId ? results[0] || null : results,
  });
}

async function handleMetricsTeams(url: URL, teamSupervisorId?: string) {
  const admin = getAdminClient();
  const { startDate, endDate } = parseDateFilters(url);

  let teamQuery = admin.from("supervisor_team_members").select("supervisor_id, member_profile_id, team_name");
  if (teamSupervisorId) teamQuery = teamQuery.eq("supervisor_id", teamSupervisorId);
  const { data: teamData } = await teamQuery;

  // Group by supervisor
  const teamMap = new Map<string, { name: string; memberIds: string[] }>();
  for (const t of teamData || []) {
    if (!teamMap.has(t.supervisor_id)) {
      teamMap.set(t.supervisor_id, { name: t.team_name || "", memberIds: [] });
    }
    teamMap.get(t.supervisor_id)!.memberIds.push(t.member_profile_id);
  }

  // Get supervisor names
  const supervisorIds = [...teamMap.keys()];
  const { data: supervisorProfiles } = await admin.from("profiles").select("user_id, name, display_name").in("user_id", supervisorIds);
  const supervisorNameMap = new Map((supervisorProfiles || []).map((p: any) => [p.user_id, p.display_name || p.name]));

  const results = [];
  for (const [supId, team] of teamMap) {
    const memberIds = team.memberIds;

    // Messages
    let msgCount = 0;
    if (memberIds.length > 0) {
      let mq = admin.from("messages").select("id", { count: "exact", head: true }).in("author_id", memberIds);
      if (startDate) mq = mq.gte("created_at", startDate);
      if (endDate) mq = mq.lte("created_at", endDate);
      const { count } = await mq;
      msgCount = count || 0;
    }

    // Tasks
    let totalTasks = 0, completedTasks = 0, lateTasks = 0;
    if (memberIds.length > 0) {
      const { data: assignees } = await admin.from("task_assignees").select("task_id").in("profile_id", memberIds);
      const taskIds = [...new Set((assignees || []).map((a: any) => a.task_id))];
      if (taskIds.length > 0) {
        let tq = admin.from("tasks").select("id, completed_at, completed_late").in("id", taskIds).eq("is_template", false);
        if (startDate) tq = tq.gte("created_at", startDate);
        if (endDate) tq = tq.lte("created_at", endDate);
        const { data: tasks } = await tq;
        totalTasks = (tasks || []).length;
        completedTasks = (tasks || []).filter((t: any) => t.completed_at).length;
        lateTasks = (tasks || []).filter((t: any) => t.completed_late).length;
      }
    }

    results.push({
      id: supId,
      team_name: team.name || supervisorNameMap.get(supId) || "Equipe",
      supervisor: supervisorNameMap.get(supId) || "Desconhecido",
      total_members: memberIds.length,
      total_messages: msgCount,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      pending_tasks: totalTasks - completedTasks,
      late_tasks: lateTasks,
      performance: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    });
  }

  return jsonResponse({
    status: "success",
    message: "Consulta realizada com sucesso.",
    data: teamSupervisorId ? results[0] || null : results,
  });
}

async function handleTasksSummary(url: URL) {
  const admin = getAdminClient();
  const { startDate, endDate } = parseDateFilters(url);
  const status = url.searchParams.get("status"); // completed, pending, late

  let query = admin.from("tasks").select("id, title, status, priority, completed_at, completed_late, due_date, created_at, assigned_to, board_id").eq("is_template", false);
  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);
  if (status === "completed") query = query.not("completed_at", "is", null);
  if (status === "pending") query = query.is("completed_at", null);
  if (status === "late") query = query.eq("completed_late", true);

  const { data: tasks, count } = await query.limit(500);

  return jsonResponse({
    status: "success",
    message: "Consulta realizada com sucesso.",
    data: {
      total: (tasks || []).length,
      tasks: (tasks || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        completed_at: t.completed_at,
        completed_late: t.completed_late,
        due_date: t.due_date,
        created_at: t.created_at,
      })),
    },
  });
}

async function handleMessagesSummary(url: URL) {
  const admin = getAdminClient();
  const { startDate, endDate } = parseDateFilters(url);

  let chatQ = admin.from("messages").select("id", { count: "exact", head: true });
  if (startDate) chatQ = chatQ.gte("created_at", startDate);
  if (endDate) chatQ = chatQ.lte("created_at", endDate);
  const { count: chatMessages } = await chatQ;

  let dmQ = admin.from("direct_messages").select("id", { count: "exact", head: true });
  if (startDate) dmQ = dmQ.gte("created_at", startDate);
  if (endDate) dmQ = dmQ.lte("created_at", endDate);
  const { count: directMessages } = await dmQ;

  let groupQ = admin.from("private_group_messages").select("id", { count: "exact", head: true });
  if (startDate) groupQ = groupQ.gte("created_at", startDate);
  if (endDate) groupQ = groupQ.lte("created_at", endDate);
  const { count: groupMessages } = await groupQ;

  return jsonResponse({
    status: "success",
    message: "Consulta realizada com sucesso.",
    data: {
      chat_messages: chatMessages || 0,
      direct_messages: directMessages || 0,
      group_messages: groupMessages || 0,
      total: (chatMessages || 0) + (directMessages || 0) + (groupMessages || 0),
      filters: { start_date: startDate, end_date: endDate },
    },
  });
}

// ===== USER DATA ENDPOINTS (for external system integration) =====
async function handleUsersData(url: URL, userId?: string) {
  const admin = getAdminClient();

  let query = admin.from("profiles").select("id, user_id, name, display_name, email, phone, avatar_url, sector_id, autonomy_level, is_active, birth_date, company, address, registration_number, work_period, user_status, last_seen_at, created_at, updated_at, profile_type");
  if (userId) query = query.eq("id", userId);
  else query = query.eq("is_active", true);
  const { data: profiles, error } = await query.order("name");

  if (error) return jsonResponse({ status: "error", message: error.message }, 500);
  if (!profiles || profiles.length === 0) return jsonResponse({ status: "success", data: userId ? null : [] });

  // Enrich with sector name, roles, teams, permissions
  const sectorIds = [...new Set((profiles || []).map((p: any) => p.sector_id).filter(Boolean))];
  const { data: sectors } = sectorIds.length > 0 ? await admin.from("sectors").select("id, name, color").in("id", sectorIds) : { data: [] };
  const sectorMap = new Map((sectors || []).map((s: any) => [s.id, s]));

  const userIds = profiles.map((p: any) => p.user_id);
  const { data: roles } = await admin.from("user_roles").select("user_id, role").in("user_id", userIds);
  const roleMap = new Map<string, string[]>();
  for (const r of roles || []) {
    if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
    roleMap.get(r.user_id)!.push(r.role);
  }

  const profileIds = profiles.map((p: any) => p.id);
  const { data: teamData } = await admin.from("supervisor_team_members").select("member_profile_id, supervisor_id, team_name").in("member_profile_id", profileIds);
  const teamMap = new Map<string, { team_name: string; supervisor_id: string }[]>();
  for (const t of teamData || []) {
    if (!teamMap.has(t.member_profile_id)) teamMap.set(t.member_profile_id, []);
    teamMap.get(t.member_profile_id)!.push({ team_name: t.team_name || "", supervisor_id: t.supervisor_id });
  }

  const results = profiles.map((p: any) => {
    const sector = sectorMap.get(p.sector_id);
    return {
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      display_name: p.display_name,
      email: p.email,
      phone: p.phone,
      avatar_url: p.avatar_url,
      department: sector ? { id: sector.id, name: sector.name, color: sector.color } : null,
      autonomy_level: p.autonomy_level,
      profile_type: p.profile_type,
      roles: roleMap.get(p.user_id) || [],
      teams: teamMap.get(p.id) || [],
      is_active: p.is_active,
      birth_date: p.birth_date,
      company: p.company,
      address: p.address,
      registration_number: p.registration_number,
      work_period: p.work_period,
      status: p.user_status,
      last_seen_at: p.last_seen_at,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  return jsonResponse({
    status: "success",
    message: "Consulta realizada com sucesso.",
    data: userId ? results[0] || null : results,
  });
}

async function handleUsersSectors(url: URL) {
  const admin = getAdminClient();
  const { data, error } = await admin.from("sectors").select("id, name, color, icon, created_at").order("name");
  if (error) return jsonResponse({ status: "error", message: error.message }, 500);

  // Count users per sector
  const results = [];
  for (const s of data || []) {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("sector_id", s.id).eq("is_active", true);
    results.push({ ...s, total_users: count || 0 });
  }

  return jsonResponse({ status: "success", data: results });
}

async function handleUsersTeams(url: URL) {
  const admin = getAdminClient();
  const { data: teamData } = await admin.from("supervisor_team_members").select("supervisor_id, member_profile_id, team_name");

  const teamMap = new Map<string, { name: string; memberIds: string[] }>();
  for (const t of teamData || []) {
    if (!teamMap.has(t.supervisor_id)) teamMap.set(t.supervisor_id, { name: t.team_name || "", memberIds: [] });
    teamMap.get(t.supervisor_id)!.memberIds.push(t.member_profile_id);
  }

  const supervisorIds = [...teamMap.keys()];
  const { data: supervisorProfiles } = await admin.from("profiles").select("user_id, id, name, display_name, email").in("user_id", supervisorIds);
  const supMap = new Map((supervisorProfiles || []).map((p: any) => [p.user_id, p]));

  const results = [];
  for (const [supId, team] of teamMap) {
    const sup = supMap.get(supId);
    // Get member details
    const { data: memberProfiles } = await admin.from("profiles").select("id, name, display_name, email, avatar_url, autonomy_level").in("id", team.memberIds);
    results.push({
      supervisor_id: supId,
      supervisor_name: sup?.display_name || sup?.name || "Desconhecido",
      team_name: team.name,
      members: (memberProfiles || []).map((m: any) => ({
        id: m.id,
        name: m.display_name || m.name,
        email: m.email,
        avatar_url: m.avatar_url,
        autonomy_level: m.autonomy_level,
      })),
    });
  }

  return jsonResponse({ status: "success", data: results });
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/";
    const method = req.method;

    // ===== ADMIN ROUTES =====
    if (path.startsWith("/admin/")) {
      const auth = await validateAdminAuth(req);
      if (!auth) {
        return jsonResponse({ status: "unauthorized", message: "Credenciais inválidas ou não autorizadas." }, 401);
      }

      if (path === "/admin/integrations" && method === "POST") {
        return handleAdminCreateIntegration(req, auth.userId);
      }
      if (path === "/admin/integrations" && method === "GET") {
        return handleAdminListIntegrations();
      }

      const idMatch = path.match(/^\/admin\/integrations\/([^/]+)\/?(activate|deactivate|regenerate|history)?$/);
      if (idMatch) {
        const integrationId = idMatch[1];
        const action = idMatch[2];

        if (action === "activate" && method === "PATCH") return handleAdminToggle(integrationId, true, auth.userId);
        if (action === "deactivate" && method === "PATCH") return handleAdminToggle(integrationId, false, auth.userId);
        if (action === "regenerate" && method === "PATCH") return handleAdminRegenerate(integrationId, auth.userId);
        if (action === "history" && method === "GET") return handleAdminHistory(integrationId);
        if (!action && method === "DELETE") return handleAdminDelete(integrationId, auth.userId);
      }

      return jsonResponse({ status: "error", message: "Rota não encontrada." }, 404);
    }

    // ===== PUBLIC API ROUTES =====
    const apiAuth = await validateApiAuth(req);
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

    if (!apiAuth) {
      return jsonResponse({ status: "unauthorized", message: "Credenciais inválidas ou não autorizadas." }, 401);
    }

    let response: Response;

    if (path === "/metrics/general" && method === "GET") {
      response = await handleMetricsGeneral(url);
    } else if (path === "/metrics/users" && method === "GET") {
      response = await handleMetricsUsers(url);
    } else if (path.match(/^\/metrics\/users\/(.+)$/) && method === "GET") {
      const uid = path.match(/^\/metrics\/users\/(.+)$/)![1];
      response = await handleMetricsUsers(url, uid);
    } else if (path === "/metrics/departments" && method === "GET") {
      response = await handleMetricsDepartments(url);
    } else if (path.match(/^\/metrics\/departments\/(.+)$/) && method === "GET") {
      const did = path.match(/^\/metrics\/departments\/(.+)$/)![1];
      response = await handleMetricsDepartments(url, did);
    } else if (path === "/metrics/teams" && method === "GET") {
      response = await handleMetricsTeams(url);
    } else if (path.match(/^\/metrics\/teams\/(.+)$/) && method === "GET") {
      const tid = path.match(/^\/metrics\/teams\/(.+)$/)![1];
      response = await handleMetricsTeams(url, tid);
    } else if (path === "/tasks/summary" && method === "GET") {
      response = await handleTasksSummary(url);
    } else if (path === "/messages/summary" && method === "GET") {
      response = await handleMessagesSummary(url);
    } else if (path === "/users/data" && method === "GET") {
      response = await handleUsersData(url);
    } else if (path.match(/^\/users\/data\/(.+)$/) && method === "GET") {
      const uid = path.match(/^\/users\/data\/(.+)$/)![1];
      response = await handleUsersData(url, uid);
    } else if (path === "/users/sectors" && method === "GET") {
      response = await handleUsersSectors(url);
    } else if (path === "/users/teams" && method === "GET") {
      response = await handleUsersTeams(url);
    } else {
      response = jsonResponse({ status: "error", message: "Rota não encontrada." }, 404);
    }

    // Log access
    const status = JSON.parse(await response.clone().text()).status === "success" ? 200 : 400;
    await logAccess(apiAuth.integrationId, path, method, status, ip);

    return response;
  } catch (error) {
    console.error("API Integration error:", error);
    return jsonResponse({ status: "error", message: "Ocorreu um erro ao processar a requisição." }, 500);
  }
});
