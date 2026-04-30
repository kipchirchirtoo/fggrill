-- Business Communications System
-- WhatsApp-style group chat for business communications

-- Communication Channels (Groups)
CREATE TABLE IF NOT EXISTS public.communication_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    channel_type VARCHAR(50) DEFAULT 'general', -- 'general', 'branch', 'department', 'project'
    branch_id BIGINT REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channel Members
CREATE TABLE IF NOT EXISTS public.channel_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES public.communication_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
    is_muted BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.channel_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES public.communication_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'file', 'image', 'announcement'
    file_url TEXT,
    file_name TEXT,
    reply_to UUID REFERENCES public.channel_messages(id),
    is_pinned BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES public.channel_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Message Read Receipts
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES public.channel_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_channels_branch ON public.communication_channels(branch_id);
CREATE INDEX IF NOT EXISTS idx_channels_active ON public.communication_channels(is_active);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON public.channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.channel_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.channel_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_message ON public.message_read_receipts(message_id);

-- Enable RLS
ALTER TABLE public.communication_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view channels they are members of
CREATE POLICY "Users can view their channels" ON public.communication_channels
    FOR SELECT USING (
        id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
    );

-- Admins can create channels
CREATE POLICY "Admins can create channels" ON public.communication_channels
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'director', 'general_manager')
        )
    );

-- Channel admins can update channels
CREATE POLICY "Channel admins can update" ON public.communication_channels
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.channel_members 
            WHERE channel_id = id 
            AND user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Users can view members of their channels
CREATE POLICY "Users can view channel members" ON public.channel_members
    FOR SELECT USING (
        channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
    );

-- Channel admins can add members
CREATE POLICY "Channel admins can add members" ON public.channel_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.channel_members 
            WHERE channel_id = channel_members.channel_id 
            AND user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Users can view messages in their channels
CREATE POLICY "Users can view channel messages" ON public.channel_messages
    FOR SELECT USING (
        channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
    );

-- Channel members can send messages
CREATE POLICY "Members can send messages" ON public.channel_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.channel_members 
            WHERE channel_id = channel_messages.channel_id 
            AND user_id = auth.uid()
        )
    );

-- Users can update their own messages
CREATE POLICY "Users can update own messages" ON public.channel_messages
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON public.channel_messages
    FOR DELETE USING (user_id = auth.uid());

-- Users can react to messages in their channels
CREATE POLICY "Users can react to messages" ON public.message_reactions
    FOR ALL USING (
        message_id IN (
            SELECT id FROM public.channel_messages 
            WHERE channel_id IN (
                SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()
            )
        )
    );

-- Users can mark messages as read
CREATE POLICY "Users can mark messages read" ON public.message_read_receipts
    FOR ALL USING (user_id = auth.uid());

-- Create default company-wide channel
INSERT INTO public.communication_channels (name, description, channel_type, created_by)
SELECT 
    'Company Announcements',
    'Official company-wide announcements and updates',
    'general',
    id
FROM public.users 
WHERE role = 'super_admin' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- Function to update channel updated_at
CREATE OR REPLACE FUNCTION update_channel_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.communication_channels 
    SET updated_at = NOW() 
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update channel timestamp on new message
CREATE TRIGGER update_channel_on_message
    AFTER INSERT ON public.channel_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_channel_timestamp();

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id UUID, p_channel_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_last_read TIMESTAMPTZ;
    v_count INTEGER;
BEGIN
    SELECT last_read_at INTO v_last_read
    FROM public.channel_members
    WHERE user_id = p_user_id AND channel_id = p_channel_id;
    
    SELECT COUNT(*) INTO v_count
    FROM public.channel_messages
    WHERE channel_id = p_channel_id 
    AND created_at > COALESCE(v_last_read, '1970-01-01'::TIMESTAMPTZ)
    AND user_id != p_user_id;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
