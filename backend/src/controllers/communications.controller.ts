import { Request, Response } from 'express';
import { supabase } from '../config/database';

export class CommunicationsController {
  /**
   * Get all channels for the current user
   * @route GET /api/communications/channels
   */
  static async getChannels(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      const { data: channels, error } = await supabase
        .from('communication_channels')
        .select(`
          *,
          created_by_user:created_by(first_name, last_name),
          members:channel_members(count),
          last_message:channel_messages(message, created_at, user_id, users(first_name, last_name))
        `)
        .eq('channel_members.user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Get unread counts for each channel
      const channelsWithUnread = await Promise.all(
        (channels || []).map(async (channel) => {
          const { data: unreadCount } = await supabase
            .rpc('get_unread_count', { 
              p_user_id: userId, 
              p_channel_id: channel.id 
            });

          return {
            ...channel,
            unread_count: unreadCount || 0
          };
        })
      );

      return res.status(200).json({ success: true, data: channelsWithUnread });
    } catch (error: any) {
      console.error('Get Channels Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Create a new channel
   * @route POST /api/communications/channels
   */
  static async createChannel(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { name, description, channel_type, branch_id, member_ids } = req.body;

      // Create channel
      const { data: channel, error: channelError } = await supabase
        .from('communication_channels')
        .insert([{
          name,
          description,
          channel_type,
          branch_id,
          created_by: userId
        }])
        .select()
        .single();

      if (channelError) throw channelError;

      // Add creator as admin
      const members = [
        { channel_id: channel.id, user_id: userId, role: 'admin' }
      ];

      // Add other members
      if (member_ids && Array.isArray(member_ids)) {
        member_ids.forEach((memberId: string) => {
          if (memberId !== userId) {
            members.push({ channel_id: channel.id, user_id: memberId, role: 'member' });
          }
        });
      }

      const { error: membersError } = await supabase
        .from('channel_members')
        .insert(members);

      if (membersError) throw membersError;

      return res.status(201).json({ success: true, data: channel });
    } catch (error: any) {
      console.error('Create Channel Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get messages for a channel
   * @route GET /api/communications/channels/:channelId/messages
   */
  static async getMessages(req: Request, res: Response) {
    try {
      const { channelId } = req.params;
      const { limit = 50, before } = req.query;

      let query = supabase
        .from('channel_messages')
        .select(`
          *,
          user:user_id(id, first_name, last_name, role),
          reply_to_message:reply_to(id, message, user_id, users(first_name, last_name)),
          reactions:message_reactions(emoji, user_id, users(first_name, last_name))
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (before) {
        query = query.lt('created_at', before as string);
      }

      const { data: messages, error } = await query;

      if (error) throw error;

      return res.status(200).json({ 
        success: true, 
        data: (messages || []).reverse() // Reverse to show oldest first
      });
    } catch (error: any) {
      console.error('Get Messages Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Send a message
   * @route POST /api/communications/channels/:channelId/messages
   */
  static async sendMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { channelId } = req.params;
      const { message, message_type = 'text', file_url, file_name, file_size, file_mime_type, reply_to } = req.body;

      const { data: newMessage, error } = await supabase
        .from('channel_messages')
        .insert([{
          channel_id: channelId,
          user_id: userId,
          message,
          message_type,
          file_url,
          file_name,
          file_size,
          file_mime_type,
          reply_to
        }])
        .select(`
          *,
          user:user_id(id, first_name, last_name, role)
        `)
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, data: newMessage });
    } catch (error: any) {
      console.error('Send Message Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Upload file to Supabase storage
   * @route POST /api/communications/upload
   */
  static async uploadFile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      // This endpoint expects multipart/form-data
      // The actual file upload should be handled by the frontend directly to Supabase Storage
      // This endpoint can be used for additional validation or metadata storage
      
      return res.status(200).json({ 
        success: true, 
        message: 'Upload files directly to Supabase Storage from frontend',
        bucket: 'communications',
        path: `${userId}/`
      });
    } catch (error: any) {
      console.error('Upload File Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Update a message
   * @route PATCH /api/communications/messages/:messageId
   */
  static async updateMessage(req: Request, res: Response) {
    try {
      const { messageId } = req.params;
      const { message } = req.body;

      const { data: updatedMessage, error } = await supabase
        .from('channel_messages')
        .update({ 
          message, 
          is_edited: true,
          updated_at: new Date()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, data: updatedMessage });
    } catch (error: any) {
      console.error('Update Message Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Delete a message
   * @route DELETE /api/communications/messages/:messageId
   */
  static async deleteMessage(req: Request, res: Response) {
    try {
      const { messageId } = req.params;

      const { error } = await supabase
        .from('channel_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      return res.status(200).json({ success: true, message: 'Message deleted' });
    } catch (error: any) {
      console.error('Delete Message Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * React to a message
   * @route POST /api/communications/messages/:messageId/react
   */
  static async reactToMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { messageId } = req.params;
      const { emoji } = req.body;

      // Check if reaction already exists
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .single();

      if (existing) {
        // Remove reaction
        await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existing.id);

        return res.status(200).json({ success: true, action: 'removed' });
      } else {
        // Add reaction
        const { data: reaction, error } = await supabase
          .from('message_reactions')
          .insert([{ message_id: messageId, user_id: userId, emoji }])
          .select()
          .single();

        if (error) throw error;

        return res.status(201).json({ success: true, action: 'added', data: reaction });
      }
    } catch (error: any) {
      console.error('React to Message Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Mark channel as read
   * @route POST /api/communications/channels/:channelId/read
   */
  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { channelId } = req.params;

      const { error } = await supabase
        .from('channel_members')
        .update({ last_read_at: new Date() })
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Mark as Read Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get channel members
   * @route GET /api/communications/channels/:channelId/members
   */
  static async getChannelMembers(req: Request, res: Response) {
    try {
      const { channelId } = req.params;

      const { data: members, error } = await supabase
        .from('channel_members')
        .select(`
          *,
          user:user_id(id, first_name, last_name, role, email)
        `)
        .eq('channel_id', channelId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ success: true, data: members });
    } catch (error: any) {
      console.error('Get Channel Members Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Add members to channel
   * @route POST /api/communications/channels/:channelId/members
   */
  static async addMembers(req: Request, res: Response) {
    try {
      const { channelId } = req.params;
      const { user_ids } = req.body;

      const members = user_ids.map((userId: string) => ({
        channel_id: channelId,
        user_id: userId,
        role: 'member'
      }));

      const { data, error } = await supabase
        .from('channel_members')
        .insert(members)
        .select();

      if (error) throw error;

      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      console.error('Add Members Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get all users for adding to channels
   * @route GET /api/communications/users
   */
  static async getUsers(req: Request, res: Response) {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, branch_id, branches(name)')
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ success: true, data: users });
    } catch (error: any) {
      console.error('Get Users Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
