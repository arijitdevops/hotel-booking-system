import { Router } from 'express';

import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { hotelsRouter } from './modules/hotels/hotels.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { roomsRouter } from './modules/rooms/rooms.routes';

/** Every versionless `/api` route lives here. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/hotels', hotelsRouter);
apiRouter.use('/rooms', roomsRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/reviews', reviewsRouter);
apiRouter.use('/admin', adminRouter);
