import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'PasarPixel <onboarding@resend.dev>';

export async function sendEmail(params: {
    to: string;
    subject: string;
    html: string;
}): Promise<void> {
    const { data, error } = await resend.emails.send({
        from: FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
    });

    if (error) {
        console.error('Resend error:', error);
        throw error;
    }
    console.log('Email sent:', data);
}
