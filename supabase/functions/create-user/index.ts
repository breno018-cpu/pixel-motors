import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, user_id, email, full_name, role, store_id } = body;

    // Handle password reset
    if (action === 'reset_password' && user_id) {
      console.log(`Resetting password for user: ${user_id}`);
      
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password: tempPassword }
      );

      if (updateError) {
        console.error('Error resetting password:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Marcar que usuário precisa trocar senha
      await supabaseAdmin
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', user_id);

      console.log(`Password reset successful for user: ${user_id}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          temp_password: tempPassword,
          message: 'Senha resetada com sucesso'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle user update
    if (action === 'update_user' && user_id) {
      console.log(`Updating user: ${user_id}`);

      // Update auth email if changed
      if (email) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { email, user_metadata: { full_name: full_name || undefined } }
        );
        if (authUpdateError) {
          console.error('Error updating auth user:', authUpdateError);
          return new Response(
            JSON.stringify({ error: authUpdateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update profile
      if (full_name || email) {
        const profileUpdate: Record<string, string> = {};
        if (full_name) profileUpdate.full_name = full_name;
        if (email) profileUpdate.email = email;
        await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', user_id);
      }

      // Update role
      if (role) {
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles').select('id').eq('user_id', user_id).single();
        if (existingRole) {
          await supabaseAdmin.from('user_roles').update({ role }).eq('user_id', user_id);
        } else {
          await supabaseAdmin.from('user_roles').insert({ user_id, role });
        }
      }

      // Update or create reseller record for store association
      const { data: existingReseller } = await supabaseAdmin
        .from('resellers').select('id').eq('user_id', user_id).single();

      if (store_id) {
        if (existingReseller) {
          await supabaseAdmin.from('resellers').update({ 
            store_id, full_name: full_name || undefined, email: email || undefined 
          }).eq('user_id', user_id);
        } else {
          await supabaseAdmin.from('resellers').insert({
            user_id, store_id, full_name: full_name || email, email, is_active: true
          });
        }
      } else if (existingReseller && !store_id) {
        await supabaseAdmin.from('resellers').update({ store_id: null }).eq('user_id', user_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuário atualizado com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle permanent user deletion
    if (action === 'permanent_delete_user' && user_id) {
      console.log(`Permanently deleting user: ${user_id}`);
      await supabaseAdmin.from('resellers').delete().eq('user_id', user_id);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);
      await supabaseAdmin.from('profiles').delete().eq('id', user_id);
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (delError) {
        return new Response(
          JSON.stringify({ error: delError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, message: 'Usuário excluído permanentemente' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete_user' && user_id) {
      console.log(`Disabling user: ${user_id}`);
      
      // Disable the user in auth
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { ban_duration: '87600h' } // Ban for 10 years (essentially disabled)
      );

      if (banError) {
        console.error('Error disabling user:', banError);
        return new Response(
          JSON.stringify({ error: banError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Also disable reseller if exists
      await supabaseAdmin
        .from('resellers')
        .update({ is_active: false })
        .eq('user_id', user_id);

      console.log(`User disabled successfully: ${user_id}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Usuário desativado com sucesso'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new user
    if (!email || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, full_name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    console.log(`Creating user: ${email} with role: ${role}`);

    // Create user in auth.users
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (createError) {
      console.error('Error creating auth user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log(`User created with ID: ${userId}`);

    // Create user role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (roleError) {
      console.error('Error creating role:', roleError);
    }

    // If role is revendedor or vendedor, create reseller record
    if ((role === 'revendedor' || role === 'vendedor') && store_id) {
      const { error: resellerError } = await supabaseAdmin
        .from('resellers')
        .insert({
          user_id: userId,
          full_name,
          email,
          store_id,
          is_active: true
        });

      if (resellerError) {
        console.error('Error creating reseller:', resellerError);
      }
    }

    console.log(`User ${email} created successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        email,
        temp_password: tempPassword,
        message: 'Usuário criado com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
