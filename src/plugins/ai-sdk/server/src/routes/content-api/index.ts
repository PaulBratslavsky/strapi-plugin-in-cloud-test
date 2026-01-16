export default {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/ask',
      handler: 'controller.ask',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/ask-stream',
      handler: 'controller.askStream',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/chat',
      handler: 'controller.chat',
      config: {
        policies: [],
      },
    },
  ],
};
